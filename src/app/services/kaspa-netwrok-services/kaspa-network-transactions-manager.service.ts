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
  IScriptPublicKey,
  ITransactionInput,
  ITransactionOutput,
  IUtxoEntry,
  kaspaToSompi,
  Opcodes,
  payToAddressScript,
  PendingTransaction,
  PrivateKey,
  PublicKey,
  ScriptBuilder,
  ScriptPublicKey,
  SighashType,
  signMessage,
  Transaction,
  UtxoEntryReference,
  XOnlyPublicKey,
} from '../../../../public/kaspa/kaspa';
import { RpcService } from './rpc.service';
import { KaspaNetworkConnectionManagerService } from './kaspa-network-connection-manager.service';
import { UtilsHelper } from '../utils.service';
import {
  KRC20OperationDataInterface,
} from '../../types/kaspa-network/krc20-operations-data.interface';
import { TotalBalanceWithUtxosInterface } from '../../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import { ERROR_CODES } from 'kaspacom-wallet-messages';
import {
  MAX_TRANSACTION_FEE,
  MINIMAL_AMOUNT_TO_SEND,
} from './kaspa-network-actions.service';
import { AppWallet } from '../../classes/AppWallet';
import {
  Krc20OperationDataService,
} from '../protocols/krc20/krc20-operation-data.service';
import { ScriptData } from '../../types/kaspa-network/script-data.interface';
import { KaspaScriptProtocolType } from '../../types/kaspa-network/kaspa-script-protocol-type.enum';
import { CommitRevealActionTransactions } from '../../types/kaspa-network/commit-reveal-action-transactions.interface';

const MIN_TRANSACTION_FEE = 1817n;
export const SUBMIT_REVEAL_MIN_UTXO_AMOUNT = 300000000n
export const MIN_FOR_SUBMIT_REVEAL_OUTPUT = 100000000n

type DoTransactionOptions = {
  notifyCreatedTransactions?: (transactionId: string) => Promise<any>;
  specialSignTransactionFunc?: (
    transaction: PendingTransaction
  ) => Promise<any>;
  additionalProtocolPaymentAmount?: bigint;
  priorityEntries?: IUtxoEntry[];
  sendAll?: boolean;
  estimateOnly?: boolean;
  changeWalletAddress?: string;
  revealScriptAddress?: string;
  skipUtxoBalanceCheck?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private readonly rpcService: RpcService,
    private readonly connectionManager: KaspaNetworkConnectionManagerService,
    private readonly utils: UtilsHelper,
  ) { }

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

  createGenericScriptFromString(
    scriptType: KaspaScriptProtocolType,
    dataString: string,
    walletAddress: string,
  ): ScriptData {
    const address = new Address(walletAddress);

    const buf = this.toUint8Array(dataString);

    const script = new ScriptBuilder()
      .addData(XOnlyPublicKey.fromAddress(address).toString())
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(this.toUint8Array(scriptType))
      .addI64(0n)
      .addData(buf)
      .addOp(Opcodes.OpEndIf);

    const scriptAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), this.rpcService.getNetwork());

    return {
      scriptAddress: scriptAddress!.toString(),
      base64data: script.toString(),
    };
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
    const additionalProtocolPaymentAmount =
      additionalOptions.additionalProtocolPaymentAmount || 0n;
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
        if (!additionalOptions.skipUtxoBalanceCheck) {
          await utxoProcessonManager.waitForPendingUtxoToFinish();
        }

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
          additionalProtocolPaymentAmount +
          MINIMAL_AMOUNT_TO_SEND &&
          context.balance!.pending > 0n
        ) {
          if (!additionalOptions.skipUtxoBalanceCheck) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }
        }

        if (context.balance!.mature < totalPaymentsAmount) {
          return {
            success: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
          };
        }
      }

      let finalPriorityFee = priorityFee;

      if (additionalProtocolPaymentAmount > priorityFee) {
        finalPriorityFee = additionalProtocolPaymentAmount;
      }

      const baseTransactionData: IGeneratorSettingsObject = {
        priorityEntries: additionalOptions.priorityEntries || [],
        entries: additionalOptions.revealScriptAddress ? [] : context,
        outputs,
        changeAddress:
          additionalOptions.changeWalletAddress ||
          this.convertPrivateKeyToAddress(privateKey.toString()),
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
        context.balance!.pending > 0n &&
        !additionalOptions.skipUtxoBalanceCheck
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

  private async doProtocolCommitTransactionWithUtxoProcessor(
    wallet: AppWallet,
    operationScript: ScriptData,
    maxPriorityFee: bigint = 0n,
    baseTransactionAmount = SUBMIT_REVEAL_MIN_UTXO_AMOUNT,
    transactionOptions: DoTransactionOptions = {}
  ) {
    const outputs = [
      {
        address: operationScript.scriptAddress,
        amount: baseTransactionAmount,
      },
    ];

    return await this.doTransactionWithUtxoProcessor(
      wallet.getUtxoProcessorManager()!,
      wallet.getPrivateKey(),
      maxPriorityFee,
      outputs,
      transactionOptions
    );
  }

  private async doProtocolRevealTransactionWithUtxoProcessor(
    wallet: AppWallet,
    operationScript: ScriptData,
    maxPriorityFee: bigint = 0n,
    commitUtxoTransactionId?: string,
    additionalOutputs: { address: string; amount: bigint }[] = [],
    transactionOptions: DoTransactionOptions = {}
  ) {
    const commitUtxos = await this.connectAndDo<IGetUtxosByAddressesResponse>(
      async () => {
        return await this.rpcService.getRpc()!.getUtxosByAddresses({
          addresses: [operationScript.scriptAddress.toString()],
        });
      }
    );

    let entry: UtxoEntryReference | undefined = commitUtxos.entries[0];

    if (commitUtxoTransactionId) {
      entry = commitUtxos.entries.find(
        (entry) => entry.outpoint.transactionId === commitUtxoTransactionId
      );
    }

    if (!entry) {
      // not support to happen
      throw new Error(
        `Commit UTXO not found, revealTransactionId: ${commitUtxoTransactionId}, scriptAddress: ${operationScript.scriptAddress
        }, wallet address: ${wallet.getAddress()}`
      );
    }

    const priorityEntries = [entry];

    const specialSignTransactionFunc = async (
      transaction: PendingTransaction
    ) => {
      transaction.sign([wallet.getPrivateKey()], false);
      const ourOutput = transaction.transaction.inputs.findIndex(
        (input) => input.signatureScript === ''
      );

      if (ourOutput !== -1) {
        const signature = await transaction.createInputSignature(
          ourOutput,
          wallet.getPrivateKey()
        );

        transaction.fillInput(
          ourOutput,
          ScriptBuilder.fromScript(
            operationScript.base64data
          ).encodePayToScriptHashSignatureScript(signature)
        );
      }
    };

    const outputs = additionalOutputs || [];

    const transactionOptionsToSend: DoTransactionOptions = {
      specialSignTransactionFunc,
      priorityEntries,
      revealScriptAddress: operationScript.scriptAddress,
      skipUtxoBalanceCheck: true,
      ...(transactionOptions || {}),
    };



    return await this.doTransactionWithUtxoProcessor(
      wallet.getUtxoProcessorManager()!,
      wallet.getPrivateKey(),
      maxPriorityFee,
      outputs,
      transactionOptionsToSend
    );

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


  public async doCommitRevealActionTransactionsAndNotifyWithUtxoProcessor(
    wallet: AppWallet,
    opertaionProtocol: KaspaScriptProtocolType,
    operationData: string,
    operationCost: bigint,
    maxPriorityFee: bigint,
    alreadyFinishedTransactions: Partial<CommitRevealActionTransactions>,
    notifyUpdate: (result: Partial<CommitRevealActionTransactions>) => Promise<void>,
    baseTransactionOptions?: DoTransactionOptions,
    additionalRevealOutputs?: { address: string; amount: bigint }[],
    revealTransactioAdditionalOptions?: DoTransactionOptions,
    commitTransactionAdditionalOptions?: DoTransactionOptions,
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: {
      commit?: string;
      commitMass?: bigint[];
      reveal?: string;
      revealMass?: bigint[];
    }
  }> {
    const holderWalletPublicAddress = wallet.getAddress();
    const operationScript = await this.createGenericScriptFromString(
      opertaionProtocol,
      operationData,
      holderWalletPublicAddress,
    );

    const commitOptions: DoTransactionOptions = {
      notifyCreatedTransactions: async (transactionId) => {
        resultTransactions.commitTransactionId = transactionId;
        await notifyUpdate(resultTransactions);
      },
      ...(baseTransactionOptions || {}),
      ...(commitTransactionAdditionalOptions || {}),
    };

    const minimalOperationCost = operationCost < MIN_TRANSACTION_FEE ? MIN_TRANSACTION_FEE : operationCost;

    const revealOptions: DoTransactionOptions = {
      notifyCreatedTransactions: async (transactionId) => {
        resultTransactions.revealTransactionId = transactionId;
        await notifyUpdate(resultTransactions);
      },
      additionalProtocolPaymentAmount: minimalOperationCost,
      ...(baseTransactionOptions || {}),
      ...(revealTransactioAdditionalOptions || {}),
    };

    const resultTransactions = { ...alreadyFinishedTransactions };

    const totalOutputsAmount =
      additionalRevealOutputs?.reduce((previousValue, currentValue) => previousValue + currentValue.amount, 0n) || 0n;

    let commitTransactionId = resultTransactions.commitTransactionId;

    return await this.connectAndDo<{
      success: boolean;
      errorCode?: number;
      result?: {
        commit?: string;
        commitMass?: bigint[];
        reveal?: string;
        revealMass?: bigint[];
      }
    }>(async () => {
      if (!resultTransactions.commitTransactionId) {
        const walletBalance = await this.getWalletTotalBalanceAndUtxos(
          holderWalletPublicAddress,
        );

        const totalWalletAmountAtStart = walletBalance.totalBalance;

        if (
          totalWalletAmountAtStart < operationCost + totalOutputsAmount ||
          totalWalletAmountAtStart < SUBMIT_REVEAL_MIN_UTXO_AMOUNT + totalOutputsAmount
        ) {
          throw new Error('Not enough wallet balance');
        }

        let baseTransactionAmount = SUBMIT_REVEAL_MIN_UTXO_AMOUNT - operationCost > MIN_FOR_SUBMIT_REVEAL_OUTPUT ? SUBMIT_REVEAL_MIN_UTXO_AMOUNT : operationCost + SUBMIT_REVEAL_MIN_UTXO_AMOUNT;

        baseTransactionAmount += totalOutputsAmount;

        const commitTransactionResult = await this.doProtocolCommitTransactionWithUtxoProcessor(
          wallet,
          operationScript,
          maxPriorityFee,
          baseTransactionAmount,
          commitOptions,
        );

        if (!commitTransactionResult.success) {
          return {
            success: false,
            errorCode: commitTransactionResult.errorCode,
          }
        }

        if (commitOptions.estimateOnly) {
          return {
            success: true,
            result: {
              commit: commitTransactionResult.result?.summary.finalTransactionId,
              commitMass: commitTransactionResult.result?.transactions.map(t => t.mass)
            },
          };
        }

        commitTransactionId = commitTransactionResult.result?.summary.finalTransactionId;
      }

      let revealTransactionId = resultTransactions.revealTransactionId;

      if (!resultTransactions.revealTransactionId) {
        const revealTransactionResult = await this.doProtocolRevealTransactionWithUtxoProcessor(
          wallet,
          operationScript,
          maxPriorityFee,
          commitTransactionId,
          additionalRevealOutputs,
          revealOptions,
        );

        if (!revealTransactionResult.success) {
          return {
            success: false,
            errorCode: revealTransactionResult.errorCode,
            result: {
              commit: commitTransactionId,
            },
          };
        }

        if (commitOptions.estimateOnly) {
          return {
            success: true,
            result: {
              reveal: revealTransactionResult.result?.summary.finalTransactionId,
              revealMass: revealTransactionResult.result?.transactions.map(t => t.mass)
            },
          };
        }

        revealTransactionId = revealTransactionResult.result?.summary.finalTransactionId;
      }

      return {
        success: true,
        result: {
          commit: commitTransactionId,
          reveal: revealTransactionId,
        }
      };
    });
  }

  async createPsktTransactionForRevealOperation(
    wallet: AppWallet,
    script: ScriptData,
    unxoEntryTransactionId: string,
    outputs?: {
      address: string;
      amount: bigint;
    }[],
  ): Promise<Transaction> {

    const revealUTXOs = await this.connectAndDo<IGetUtxosByAddressesResponse>(
      async () => {
        return await this.rpcService.getRpc()!.getUtxosByAddresses({
          addresses: [script.scriptAddress],
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

    const transactionOutputs: ITransactionOutput[] = outputs?.map(
      (output) => ({
        scriptPublicKey: payToAddressScript(output.address),
        value: output.amount,
      })) || [];

    if (transactionOutputs[0]) {
      transactionOutputs[0].value += entry.amount;
    }


    let transaction = new Transaction({
      version: 0,
      lockTime: 0n,
      inputs,
      outputs: transactionOutputs,
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
      ScriptBuilder.fromScript(script.base64data).encodePayToScriptHashSignatureScript(
        signature
      );

    console.log(transaction.serializeToSafeJSON());

    return transaction;
  }

  async signPsktTransaction(
    wallet: AppWallet,
    transactionJson: string,
    priorityFee: bigint = 0n,
    submitTransaction: boolean = false
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

      if (submitTransaction) {
        const transactionResult = await this.rpcService
          .getRpc()!
          .submitTransaction({ transaction });

        result.transactionId = transactionResult.transactionId;
      }

      return result;
    });
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

  getWalletAddressFromScriptPublicKey(scriptPublicKey: string | IScriptPublicKey | ScriptPublicKey): string {
    const result = addressFromScriptPublicKey(
      scriptPublicKey as any,
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
