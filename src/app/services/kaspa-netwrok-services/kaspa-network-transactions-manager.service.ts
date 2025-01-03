import { Injectable, input, Signal } from '@angular/core';
import {
  Address,
  addressFromScriptPublicKey,
  calculateTransactionFee,
  createInputSignature,
  createTransactions,
  FeeSource,
  ICreateTransactions,
  IFeeEstimate,
  IFees,
  IGeneratorSettingsObject,
  IGetUtxosByAddressesResponse,
  IPaymentOutput,
  ITransactionInput,
  ITransactionOutput,
  IUtxoEntry,
  Opcodes,
  payToAddressScript,
  PendingTransaction,
  PrivateKey,
  PublicKey,
  ScriptBuilder,
  SighashType,
  signMessage,
  Transaction,
  UtxoEntryReference,
} from '../../../../public/kaspa/kaspa';
import { RpcService } from './rpc.service';
import { KaspaNetworkConnectionManagerService } from './kaspa-network-connection-manager.service';
import { UtilsHelper } from '../utils.service';
import {
  KRC20OperationDataInterface,
  KRC20OperationType,
} from '../../types/kaspa-network/krc20-operations-data.interface';
import { TotalBalanceWithUtxosInterface } from '../../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import { ERROR_CODES, LOCAL_STORAGE_KEYS } from '../../config/consts';
import {
  MAX_TRANSACTION_FEE,
  MINIMAL_AMOUNT_TO_SEND,
} from './kaspa-network-actions.service';
import { AppWallet } from '../../classes/AppWallet';
import {
  KASPA_AMOUNT_FOR_KRC20_ACTION,
  KASPA_AMOUNT_FOR_LIST_KRC20_ACTION,
  Krc20OperationDataService,
} from './krc20-operation-data.service';
import { UnfinishedKrc20Action } from '../../types/kaspa-network/unfinished-krc20-action.interface';
import { ActionWithPsktGenerationData } from '../../types/wallet-action';

type DoTransactionOptions = {
  notifyCreatedTransactions?: (transactionId: string) => Promise<any>;
  specialSignTransactionFunc?: (
    transaction: PendingTransaction
  ) => Promise<any>;
  additionalKrc20TransactionPriorityFee?: bigint;
  priorityEntries?: IUtxoEntry[];
  sendAll?: boolean;
  estimateOnly?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private readonly rpcService: RpcService,
    private readonly connectionManager: KaspaNetworkConnectionManagerService,
    private readonly utils: UtilsHelper,
    private readonly krc20OperationDataService: Krc20OperationDataService
  ) {}

  async connectAndDo<T>(
    fn: () => Promise<T>,
    attempts: number = Infinity
  ): Promise<T> {
    await this.utils.retryOnError(async () => {
      await this.connectionManager.waitForConnection();
    }, attempts);

    return await fn();
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.connectionManager.getConnectionStatusSignal();
  }

  private toUint8Array(data: string): Uint8Array {
    return new TextEncoder().encode(data);
  }

  createP2SHAddressScriptForKrc20Action(
    data: KRC20OperationDataInterface,
    publicKey: PublicKey
  ): {
    script: ScriptBuilder;
    p2shaAddress: Address;
  } {
    const fixedData = {
      ...data,
      tick: data.tick.toLowerCase(),
    };
    const script = new ScriptBuilder()
      .addData(publicKey.toXOnlyPublicKey().toString())
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(this.toUint8Array('kasplex'))
      .addI64(0n)
      .addData(this.toUint8Array(JSON.stringify(fixedData)))
      .addOp(Opcodes.OpEndIf);

    const scriptAddress = addressFromScriptPublicKey(
      script.createPayToScriptHashScript(),
      this.rpcService.getNetwork()
    );

    if (!scriptAddress) {
      throw new Error('Failed to create P2SH address');
    }

    return {
      script,
      p2shaAddress: scriptAddress!,
    };
  }

  async initUtxoProcessorManager(
    address: string,
    onBalanceUpdate: () => Promise<any>
  ): Promise<UtxoProcessorManager> {
    return await this.connectAndDo(async () => {
      const utxoProcessonManager = new UtxoProcessorManager(
        this.rpcService.getRpc()!,
        this.rpcService.getNetwork(),
        address,
        onBalanceUpdate
      );

      await utxoProcessonManager.init();

      return utxoProcessonManager;
    });
  }

  // ================================================================
  // DO TRANSACTIONS WITH UTXOS PROCESSOR
  // ================================================================

  private async doTransactionWithUtxoProcessor(
    utxoProcessonManager: UtxoProcessorManager,
    privateKey: PrivateKey,
    priorityFee: bigint,
    outputs: IPaymentOutput[],
    additionalOptions: DoTransactionOptions = {}
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: ICreateTransactions;
  }> {
    const additionalKrc20TransactionPriorityFee =
      additionalOptions.additionalKrc20TransactionPriorityFee || 0n;
    const sendAll = additionalOptions.sendAll || false;
    let totalPaymentsAmount = outputs.reduce(
      (previousValue, currentValue) => previousValue + currentValue.amount,
      0n
    );

    return await this.connectAndDo<{
      success: boolean;
      errorCode?: number;
      result?: ICreateTransactions;
    }>(async () => {
      const context = utxoProcessonManager.getContext()!;

      if (sendAll) {
        await utxoProcessonManager.waitForPendingUtxoToFinish();
        const remeaingAmountToSend =
          context.balance!.mature - (totalPaymentsAmount - outputs[0].amount);

        if (remeaingAmountToSend <= MINIMAL_AMOUNT_TO_SEND) {
          return {
            success: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
          };
        }

        outputs[0].amount = remeaingAmountToSend;
        totalPaymentsAmount = outputs.reduce(
          (previousValue, currentValue) => previousValue + currentValue.amount,
          0n
        );
      } else {
        if (
          context.balance!.mature <
            totalPaymentsAmount +
              additionalKrc20TransactionPriorityFee +
              MINIMAL_AMOUNT_TO_SEND &&
          context.balance!.pending > 0n
        ) {
          await utxoProcessonManager.waitForPendingUtxoToFinish();
        }

        if (context.balance!.mature < totalPaymentsAmount) {
          return {
            success: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
          };
        }
      }

      let finalPriorityFee = priorityFee;

      if (additionalKrc20TransactionPriorityFee > priorityFee) {
        finalPriorityFee = additionalKrc20TransactionPriorityFee;
      }

      const baseTransactionData: IGeneratorSettingsObject = {
        priorityEntries: additionalOptions.priorityEntries || [],
        entries: context,
        outputs,
        changeAddress: this.convertPrivateKeyToAddress(privateKey.toString()),
        priorityFee: {
          amount: finalPriorityFee,
          source: sendAll ? FeeSource.ReceiverPays : FeeSource.SenderPays,
        },
        networkId: this.rpcService.getNetwork(),
      };

      if (
        !sendAll &&
        context.balance!.mature <
          totalPaymentsAmount +
            MINIMAL_AMOUNT_TO_SEND +
            (baseTransactionData.priorityFee as IFees).amount &&
        context.balance!.pending > 0n
      ) {
        await utxoProcessonManager.waitForPendingUtxoToFinish();
      }

      if (
        context.balance!.mature < totalPaymentsAmount ||
        (outputs.length && outputs[0].amount <= MINIMAL_AMOUNT_TO_SEND)
      ) {
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
        };
      }

      const currentTransactions = await this.utils.retryOnError(async () => {
        return await createTransactions(baseTransactionData);
      });

      console.log(
        'current transaction amount',
        currentTransactions.transactions.length
      );
      console.log('current transaction summry', currentTransactions.summary);

      if (additionalOptions.estimateOnly) {
        return {
          success: true,
          result: currentTransactions,
        };
      }

      if (additionalOptions.notifyCreatedTransactions) {
        await additionalOptions.notifyCreatedTransactions(
          currentTransactions.summary.finalTransactionId!
        );
      }

      const transactionsLeftToSend: PendingTransaction[] = [
        ...currentTransactions.transactions,
      ];

      while (transactionsLeftToSend.length > 0) {
        const transaction = transactionsLeftToSend[0];
        const isFinalTransaction = transactionsLeftToSend.length == 1;

        if (
          additionalOptions.specialSignTransactionFunc &&
          isFinalTransaction
        ) {
          await additionalOptions.specialSignTransactionFunc(transaction);
        } else {
          transaction.sign([privateKey]);
        }

        await this.connectAndDo(async () => {
          let transactionPromise = null;

          if (isFinalTransaction) {
            transactionPromise = utxoProcessonManager.getTransactionPromise(
              transaction.id
            );
          }

          await transaction.submit(this.rpcService.getRpc()!);
          transactionsLeftToSend.shift();

          if (isFinalTransaction) {
            try {
              await transactionPromise!;
            } catch (error) {
              console.error('Transaction not received', error);

              // await this.verifyTransactionReceivedOnKaspaApi(
              //   transaction.id,
              // );
            }
          }
        });
      }

      return {
        success: true,
        result: currentTransactions,
      };
    });
  }

  async doKaspaTransferTransactionWithUtxoProcessor(
    wallet: AppWallet,
    payments: IPaymentOutput[],
    priorityFee: bigint,
    sendAll = false, // Sends all the remains to the first payment
    notifyCreatedTransactions?: (transactionId: string) => Promise<any>,
    estimateOnly: boolean = false
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: ICreateTransactions;
  }> {
    return await this.doTransactionWithUtxoProcessor(
      wallet.getUtxoProcessorManager()!,
      wallet.getPrivateKey(),
      priorityFee,
      payments,
      {
        notifyCreatedTransactions,
        sendAll,
        estimateOnly,
      }
    );
  }

  async createPsktTransactionForSendOperation(
    wallet: AppWallet,
    krc20transactionData: KRC20OperationDataInterface,
    unxoEntryTransactionId: string,
    amount: bigint,
    commission?: {
      address: string;
      amount: bigint;
    }
  ): Promise<Transaction> {
    const scriptAndScriptAddress = this.createP2SHAddressScriptForKrc20Action(
      krc20transactionData,
      wallet.getPrivateKey().toPublicKey()
    );

    const revealUTXOs = await this.connectAndDo<IGetUtxosByAddressesResponse>(
      async () => {
        return await this.rpcService.getRpc()!.getUtxosByAddresses({
          addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
        });
      }
    );

    let entry: UtxoEntryReference | undefined = revealUTXOs.entries[0];

    if (unxoEntryTransactionId) {
      entry = revealUTXOs.entries.find(
        (entry) => entry.outpoint.transactionId === unxoEntryTransactionId
      );
    }

    if (!entry) {
      throw new Error('Utxo entry not found, please check your inputs');
    }

    const inputs: ITransactionInput[] = [
      {
        previousOutpoint: entry.outpoint,
        utxo: entry,
        sequence: 0n,
        sigOpCount: 1,
      },
    ];

    const outputs: ITransactionOutput[] = [
      {
        scriptPublicKey: payToAddressScript(wallet.getAddress()),
        value: amount + entry.amount,
      },
    ];

    if (commission) {
      outputs.push({
        scriptPublicKey: payToAddressScript(commission.address),
        value: commission.amount,
      });
    }

    let transaction = new Transaction({
      version: 0,
      lockTime: 0n,
      inputs,
      outputs,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: '',
    });

    const signature = createInputSignature(
      transaction,
      0,
      wallet.getPrivateKey(),
      SighashType.SingleAnyOneCanPay
    );

    transaction.inputs[0].signatureScript =
      scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(
        signature
      );

    console.log(transaction.serializeToSafeJSON());

    return transaction;
  }

  async completePsktTransactionForSendOperation(
    wallet: AppWallet,
    transactionJson: string,
    priorityFee: bigint = 0n,
    signOnly: boolean = false
  ): Promise<{
    psktTransaction: string;
    transactionId?: string;
    transactionFee?: bigint;
  }> {
    const transaction = Transaction.deserializeFromSafeJSON(transactionJson);

    return await this.connectAndDo(async () => {
      const totalOutputs = transaction.outputs.reduce(
        (total, output) => total + output.value,
        0n
      );
      const totalRequiredOutputs =
        totalOutputs +
        priorityFee +
        MINIMAL_AMOUNT_TO_SEND +
        MAX_TRANSACTION_FEE;

      let utxos = wallet.getBalanceSignal()()
        ? [...wallet.getBalanceSignal()()!.utxoEntries]
        : [];

      if (!utxos) {
        throw new Error('No utxos found');
      }

      utxos = utxos.sort((a, b) => Number(b.amount - a.amount));

      const utxosToUse = [];
      let utxosSum = 0n;

      while (utxosSum < totalRequiredOutputs && utxos.length > 0) {
        const utxo = utxos.shift()!;
        utxosToUse.push(utxo);
        utxosSum += utxo.amount;
      }

      if (utxosSum < totalRequiredOutputs) {
        throw new Error('Not enough utxos to complete transaction');
      }

      const buyerInputs: ITransactionInput[] = utxosToUse.map((utxo) => ({
        previousOutpoint: utxo.outpoint,
        utxo: utxo,
        sequence: 0n,
        sigOpCount: 1,
      }));

      let index = transaction.inputs.length;

      transaction.inputs = [...transaction.inputs, ...buyerInputs];

      const totalInputsAmount = transaction.inputs.reduce(
        (total, input) => total + input.utxo!.amount,
        0n
      );

      const totalOutputsAmount = transaction.outputs.reduce(
        (total, output) => total + output.value,
        0n
      );

      const change = totalInputsAmount - totalOutputsAmount;

      if (change <= MINIMAL_AMOUNT_TO_SEND) {
        throw new Error('NOT ENOUGH CHANGE');
      }

      const feePayerIndex = 1;

      transaction.outputs = [
        transaction.outputs[0],
        {
          scriptPublicKey: payToAddressScript(wallet.getAddress()),
          value: change,
        },
        ...transaction.outputs.slice(1),
      ];

      const transactionFee = calculateTransactionFee(
        this.rpcService.getNetwork(),
        transaction
      );

      if (!transactionFee) {
        throw new Error('Transaction fee not calculated');
      }

      const totalFees = transactionFee + priorityFee;

      transaction.outputs[feePayerIndex].value -= totalFees;

      if (transaction.outputs[feePayerIndex].value < MINIMAL_AMOUNT_TO_SEND) {
        throw new Error('NOT ENOUGH CHANGE');
      }

      for (let i = index; i < transaction.inputs.length; i++) {
        const signature = createInputSignature(
          transaction,
          index,
          wallet.getPrivateKey(),
          SighashType.All
        );

        transaction.inputs[i].signatureScript = signature;
      }

      // Validation (IMPORTANT!)
      const inputsSum = transaction.inputs.reduce(
        (sum, input) => sum + input.utxo!.amount,
        0n
      );
      const outputsSum = transaction.outputs.reduce(
        (sum, output) => sum + output.value,
        0n
      );

      if (inputsSum !== outputsSum + totalFees) {
        console.error('Inputs and outputs sums are not equal', {
          inputsSum,
          outputsSum,
          totalFees,
        });
        throw Error('Inputs and outputs sums are not equal');
      }

      const result: {
        psktTransaction: string;
        transactionFee?: bigint;
        transactionId?: string;
      } = {
        psktTransaction: transaction.serializeToSafeJSON(),
        transactionFee: transactionFee,
      };

      if (!signOnly) {
        const transactionResult = await this.rpcService
          .getRpc()!
          .submitTransaction({ transaction });

        result.transactionId = transactionResult.transactionId;
      }

      return result;
    });
  }

  async doKrc20ActionTransactionWithUtxoProcessor(
    wallet: AppWallet,
    krc20transactionData: KRC20OperationDataInterface,
    priorityFee: bigint,
    transactionFeeAmount: bigint,
    notifyCreatedTransactions?: (transactionId: string) => Promise<any>,
    revealOnly: boolean = false,
    transactionId?: string,
    psktOptions?: ActionWithPsktGenerationData,
    estimateOnly: boolean = false
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: {
      commit?: ICreateTransactions;
      reveal?: ICreateTransactions;
      pskt?: Transaction;
    };
  }> {
    let commitTransactionResult:
      | { success: boolean; errorCode?: number; result?: ICreateTransactions }
      | undefined = undefined;
    if (!revealOnly) {
      commitTransactionResult =
        await this.doKrc20CommitTransactionWithUtxoProcessor(
          wallet.getUtxoProcessorManager()!,
          wallet.getPrivateKey(),
          krc20transactionData,
          priorityFee,
          async (transactionId) => {
            await this.addUnfinishedKrc20ActionOnLocalStorage({
              createdAtTimestamp: Date.now(),
              operationData: krc20transactionData,
              walletAddress: wallet.getAddress(),
            });

            if (notifyCreatedTransactions) {
              await notifyCreatedTransactions(transactionId);
            }
          },
          estimateOnly
        );

      if (!commitTransactionResult.success) {
        return {
          success: false,
          errorCode: commitTransactionResult.errorCode,
        };
      }

      if (estimateOnly) {
        return {
          success: true,
          result: {
            commit: commitTransactionResult.result,
          },
        };
      }
    }

    const revealTransactionResult =
      await this.doKrc20RevealTransactionWithUtxoProcessor(
        wallet.getUtxoProcessorManager()!,
        wallet.getPrivateKey(),
        krc20transactionData,
        transactionFeeAmount,
        priorityFee,
        notifyCreatedTransactions,
        transactionId,
        estimateOnly
      );

    if (!revealTransactionResult.success) {
      return {
        success: false,
        errorCode: revealTransactionResult.errorCode,
        result: {
          commit: commitTransactionResult?.result,
        },
      };
    }

    await this.removeUnfinishedActionOnLocalStorage({
      operationData: krc20transactionData,
      walletAddress: wallet.getAddress(),
      createdAtTimestamp: Date.now(),
    });

    let psktTransaction = undefined;

    if (psktOptions) {
      psktTransaction = await this.createPsktTransactionForSendOperation(
        wallet,
        this.krc20OperationDataService.getSendData(krc20transactionData.tick),
        revealTransactionResult.result!.summary!.finalTransactionId!,
        psktOptions.totalPrice,
        psktOptions.commission
      );
    }

    return {
      success: true,
      result: {
        commit: commitTransactionResult?.result,
        reveal: revealTransactionResult.result,
        pskt: psktTransaction,
      },
    };
  }

  async doKrc20CommitTransactionWithUtxoProcessor(
    utxoProcessonManager: UtxoProcessorManager,
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    priorityFee: bigint = 0n,
    notifyCreatedTransactions?: (transactionId: string) => Promise<any>,
    estimateOnly: boolean = false
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: ICreateTransactions;
  }> {
    const scriptAndScriptAddress = this.createP2SHAddressScriptForKrc20Action(
      krc20transactionData,
      privateKey.toPublicKey()
    );

    const outputs = [
      {
        address: scriptAndScriptAddress.p2shaAddress.toString(),
        amount: KASPA_AMOUNT_FOR_KRC20_ACTION,
      },
    ];

    return await this.doTransactionWithUtxoProcessor(
      utxoProcessonManager,
      privateKey,
      priorityFee,
      outputs,
      {
        notifyCreatedTransactions,
        estimateOnly,
      }
    );
  }

  async doKrc20RevealTransactionWithUtxoProcessor(
    utxoProcessonManager: UtxoProcessorManager,
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    transactionFeeAmount: bigint,
    priorityFee: bigint = 0n,
    notifyCreatedTransactions?: (transactionId: string) => Promise<any>,
    revealTransactionId: string | undefined = undefined,
    estimateOnly: boolean = false
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: ICreateTransactions;
  }> {
    // console.log(privateKey.toPublicKey().toString(), 'pub ky');
    const scriptAndScriptAddress = this.createP2SHAddressScriptForKrc20Action(
      krc20transactionData,
      privateKey.toPublicKey()
    );

    const revealUTXOs = await this.connectAndDo<IGetUtxosByAddressesResponse>(
      async () => {
        return await this.rpcService.getRpc()!.getUtxosByAddresses({
          addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
        });
      }
    );

    let entry: UtxoEntryReference | undefined = revealUTXOs.entries[0];

    if (revealTransactionId) {
      entry = revealUTXOs.entries.find(
        (entry) => entry.outpoint.transactionId === revealTransactionId
      );
    }

    if (!entry) {
      return {
        success: false,
        errorCode: ERROR_CODES.WALLET_ACTION.REVEAL_TRANSACTION_NOT_FOUND,
      };
    }

    const priorityEntries = [entry];

    const specialSignTransactionFunc = async (
      transaction: PendingTransaction
    ) => {
      transaction.sign([privateKey], false);
      const ourOutput = transaction.transaction.inputs.findIndex(
        (input) => input.signatureScript === ''
      );

      if (ourOutput !== -1) {
        const signature = await transaction.createInputSignature(
          ourOutput,
          privateKey
        );

        transaction.fillInput(
          ourOutput,
          scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(
            signature
          )
        );
      }
    };

    const outputs: IPaymentOutput[] = [];

    if (krc20transactionData.op === KRC20OperationType.LIST) {
      const sendTransaction = this.createP2SHAddressScriptForKrc20Action(
        this.krc20OperationDataService.getSendData(krc20transactionData.tick),
        privateKey.toPublicKey()
      );

      outputs.push({
        address: sendTransaction.p2shaAddress.toString(),
        amount: KASPA_AMOUNT_FOR_LIST_KRC20_ACTION,
      });
    }

    return await this.doTransactionWithUtxoProcessor(
      utxoProcessonManager,
      privateKey,
      priorityFee,
      outputs,
      {
        notifyCreatedTransactions,
        specialSignTransactionFunc,
        additionalKrc20TransactionPriorityFee: transactionFeeAmount,
        priorityEntries,
        estimateOnly,
      }
    );
  }

  //   // ================================================================
  //   // OTHER
  //   // ================================================================

  convertPrivateKeyToAddress(privateKey: string): string {
    return new PrivateKey(privateKey)
      .toPublicKey()
      .toAddress(this.rpcService.getNetwork())
      .toString();
  }

  async getEstimateFeeRates(): Promise<IFeeEstimate> {
    const fees = await this.rpcService.getRpc()!.getFeeEstimate({});

    return fees.estimate;
  }

  async getWalletTotalBalanceAndUtxos(
    address: string
  ): Promise<TotalBalanceWithUtxosInterface> {
    const utxoEntries = await this.getWalletUtxos(address);

    return {
      totalBalance: utxoEntries.reduce((acc, curr) => acc + curr.amount, 0n),
      utxoEntries: utxoEntries,
    };
  }

  async getWalletUtxos(address: string): Promise<UtxoEntryReference[]> {
    return await this.connectAndDo(async () => {
      const utxos = await this.rpcService.getRpc()!.getUtxosByAddresses({
        addresses: [address],
      });

      return utxos.entries;
    });
  }

  //   getPublicKeyAddress(publicKey: string): string {
  //     return new PublicKey(publicKey).toAddress(this.rpcService.getNetwork()).toString();
  //   }

  //   async veryfySignedMessageAndGetWalletAddress(message: string, signature: string, publicKeyStr: string): Promise<string | null> {
  //     const publicKey = new PublicKey(publicKeyStr);

  //     if (await verifyMessage({ message, signature, publicKey })) {
  //       return publicKey.toAddress(this.rpcService.getNetwork()).toString();
  //     }

  //     return null;
  //   }

  //   async verifyTransactionReceivedOnKaspaApi(txnId: string, stopOnApplicationClosing: boolean = false): Promise<void> {
  //     await this.utils.retryOnError(
  //       async () => {
  //         if (stopOnApplicationClosing) {
  //           throw new ApplicationIsClosingError();
  //         }

  //         return await this.kaspaApiService.getTxnInfo(txnId);
  //       },
  //       NUMBER_OF_MINUTES_TO_KEEP_CHECKING_TRANSACTION_RECEIVED,
  //       TIME_TO_WAIT_BEFORE_TRANSACTION_RECEIVED_CHECK,
  //       true,
  //       (error) => error instanceof ApplicationIsClosingError,
  //     );
  //   }

  //   getWalletAddressFromScriptPublicKey(scriptPublicKey: string): string {
  //     return addressFromScriptPublicKey(scriptPublicKey, this.rpcService.getNetwork()).toString();
  //   }

  async updateUnfinishedKrc20ActionOnLocalStorage(
    updateFunction: (
      data: UnfinishedKrc20Action[]
    ) => Promise<UnfinishedKrc20Action[]>
  ): Promise<void> {
    const actions = this.getUnfinishedKrc20Actions();
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_KRC20_ACTIONS,
      JSON.stringify(await updateFunction(actions))
    );
  }

  async addUnfinishedKrc20ActionOnLocalStorage(
    action: UnfinishedKrc20Action
  ): Promise<void> {
    await this.updateUnfinishedKrc20ActionOnLocalStorage(async (data) => {
      data.push(action);

      return data;
    });
  }

  async removeUnfinishedActionOnLocalStorage(
    action: UnfinishedKrc20Action
  ): Promise<void> {
    await this.updateUnfinishedKrc20ActionOnLocalStorage(async (data) => {
      const index = data.findIndex(
        (item) =>
          JSON.stringify(item.operationData) ===
            JSON.stringify(action.operationData) &&
          action.walletAddress == item.walletAddress
      );
      if (index !== -1) {
        data.splice(index, 1);
      }

      return data;
    });
  }

  async checkUnfinishedTransactionsForUserAndGetOne(
    wallet: AppWallet,
    timeAgo: number = 2 * 60 * 1000
  ): Promise<UnfinishedKrc20Action | undefined> {
    let actions = this.getUnfinishedKrc20Actions();
    let walletUnfinishedActions = actions.filter(
      (item) =>
        item.walletAddress === wallet.getAddress() &&
        item.createdAtTimestamp < Date.now() - timeAgo
    );
    let currentUnfinishedAction: UnfinishedKrc20Action | undefined = undefined;

    while (walletUnfinishedActions.length > 0 && !currentUnfinishedAction) {
      currentUnfinishedAction = walletUnfinishedActions[0];

      const hasMoney = await this.doesUnfinishedActionHasKasInScriptWallet(
        wallet,
        currentUnfinishedAction.operationData
      );

      if (hasMoney) {
        break;
      } else {
        await this.removeUnfinishedActionOnLocalStorage(
          currentUnfinishedAction
        );
        currentUnfinishedAction = undefined;
      }

      actions = this.getUnfinishedKrc20Actions();
      walletUnfinishedActions = actions.filter(
        (item) => item.walletAddress === wallet.getAddress()
      );
    }

    return currentUnfinishedAction;
  }

  getUnfinishedKrc20Actions(): UnfinishedKrc20Action[] {
    const totalActionsJson = localStorage.getItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_KRC20_ACTIONS
    );
    const totalActions = JSON.parse(
      totalActionsJson || '[]'
    ) as UnfinishedKrc20Action[];
    return totalActions;
  }

  async doesUnfinishedActionHasKasInScriptWallet(
    wallet: AppWallet,
    action: KRC20OperationDataInterface
  ): Promise<boolean> {
    const script = this.createP2SHAddressScriptForKrc20Action(
      action,
      wallet.getPrivateKey().toPublicKey()
    );
    const hasMoney = await this.getWalletTotalBalanceAndUtxos(
      script.p2shaAddress.toString()
    );

    return hasMoney.totalBalance > 0n;
  }

  getWalletAddressFromScriptPublicKey(scriptPublicKey: string): string {
    const result = addressFromScriptPublicKey(
      scriptPublicKey,
      this.rpcService.getNetwork()
    );

    if (!result) {
      throw new Error('Invalid script public key');
    }

    const address = result.toString();

    if (this.utils.isNullOrEmptyString(address)) {
      throw new Error('Invalid script public key');
    }

    return address;
  }

  signMessage(
    privateKey: PrivateKey,
    message: string
  ): {
    signedMessage: string;
    publickey: string;
  } {
    return {
      signedMessage: signMessage({
        message,
        privateKey: privateKey,
      }),
      publickey: privateKey.toPublicKey().toString(),
    };
  }
}
