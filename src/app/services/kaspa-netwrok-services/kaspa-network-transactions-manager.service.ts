import { Injectable, input, Signal } from '@angular/core';

interface DomainInscriptionData {
  op: "create";
  p: "domain";
  v: string;  // domain name
  s?: "kas";  // suffix (optional, defaults to .kas)
}

interface DomainVerificationResult {
  success: boolean;
  data?: {
    id: string;
    asset: string;
    owner: string;
  };
  message?: string;
}

interface DomainRegistrationRequest {
  domain: string;
  ownerAddress: string;
  publicKey: string;
  network: string;
  fee: number;
}

interface DomainRegistrationResponse {
  script: string;
  commitTx: any;
  revealTx: any;
}

interface CommitRevealResult {
  commitTxId: string;
  revealTxId: string;
}
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
  XOnlyPublicKey,
  type HexString,
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

  private utxoProcessorManager: UtxoProcessorManager | null = null;

  async initUtxoProcessorManager(
    address: string,
    onBalanceUpdate: () => Promise<any>
  ): Promise<UtxoProcessorManager> {
    return await this.connectAndDo(async () => {
      if (this.utxoProcessorManager) {
        return this.utxoProcessorManager;
      }

      this.utxoProcessorManager = new UtxoProcessorManager(
        this.rpcService.getRpc()!,
        this.rpcService.getNetwork(),
        address,
        onBalanceUpdate
      );

      await this.utxoProcessorManager.init();

      return this.utxoProcessorManager;
    });
  }

  getUtxoProcessorManager(): UtxoProcessorManager {
    if (!this.utxoProcessorManager) {
      throw new Error('UTXO processor manager not initialized');
    }
    return this.utxoProcessorManager;
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
      // Wait for UTXO processor to be ready and get context
      await utxoProcessonManager.waitForPendingUtxoToFinish();
      const context = utxoProcessonManager.getContext();
      
      if (!context) {
        console.error('UTXO context not initialized');
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE
        };
      }

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

  // ================================================================
  // INSCRIPTIONS
  // ================================================================

  async createTextInscription(
    wallet: AppWallet,
    text: string,
    priorityFee: bigint = 0n
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: any;
  }> {
    try {
      // Verify kasware is available
      if (!(window as any).kasware) {
        throw new Error('Kasware wallet not detected');
      }

      // Get UTXO entries and network info from kasware
      const entries = await (window as any).kasware.getUtxoEntries();
      const [address] = await (window as any).kasware.getAccounts();
      const publicKey = await (window as any).kasware.getPublicKey(address);
      const network = await (window as any).kasware.getNetwork();
      
      // Convert amounts to sompi
      const SOMPI = 100000000n;
      const commitAmount = 0.001 * Number(SOMPI);
      const revealAmount = 0.0005 * Number(SOMPI);
      
      // Determine network ID
      let networkId = "testnet-10";
      switch (network) {
        case "kaspa_mainnet":
          networkId = "mainnet";
          break;
        case "kaspa_testnet_11":
          networkId = "testnet-11";
          break;
        case "kaspa_testnet_10":
          networkId = "testnet-10";
          break;
        case "kaspa_devnet":
          networkId = "devnet";
          break;
        default:
          networkId = "testnet-10";
          break;
      }

      // Create script for text inscription
      const script = new ScriptBuilder()
        .addData(wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString() as HexString)
        .addOp(Opcodes.OpCheckSig)
        .addOp(Opcodes.OpFalse)
        .addOp(Opcodes.OpIf)
        .addData(this.toUint8Array('kns'))
        .addI64(0n)
        .addData(this.toUint8Array(text))
        .addOp(Opcodes.OpEndIf);

      // Create commit and reveal transactions
      const scriptAddress = addressFromScriptPublicKey(
        script.createPayToScriptHashScript(),
        this.rpcService.getNetwork()
      );

      if (!scriptAddress) {
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS
        };
      }

      // Verify kasware is available
      if (!(window as any).kasware) {
        throw new Error('Kasware wallet not detected');
      }

      // Convert BigInt amounts to strings for JSON serialization
      const commit = {
        priorityEntries: [],
      entries: entries.map((e: IUtxoEntry) => ({
          ...e,
          amount: e.amount.toString()
        })),
        outputs: [{ 
          address: scriptAddress.toString(), 
          amount: KASPA_AMOUNT_FOR_KRC20_ACTION.toString() 
        }],
        changeAddress: address,
        priorityFee: priorityFee.toString()
      };

      const reveal = {
        outputs: [],
        changeAddress: address,
        priorityFee: (BigInt(priorityFee) + BigInt(1e6)).toString() // Add 0.01 KAS
      };

      // Create script and submit through kasware
      const scriptHex = script.createPayToScriptHashScript().toString();
      
      try {
        // Open kasware wallet UI
        await (window as any).kasware.connect();
        
        const results = await (window as any).kasware.submitCommitReveal(
          JSON.parse(JSON.stringify(commit)), // Ensure proper serialization
          JSON.parse(JSON.stringify(reveal)), // Ensure proper serialization
          scriptHex,
          networkId
        );

        console.log('Kasware commit/reveal results:', results);
        return {
          success: true,
          result: results
        };
      } catch (error: any) {
        console.error('Kasware commit/reveal failed:', error);
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
          result: {
            error: error.message
          }
        };
      }
    } catch (error) {
      console.error('Text inscription failed:', error);
      return {
        success: false,
        errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR
      };
    }
  }

  // Debug logging function
  private logCommitRevealDetails(step: string, data: any) {
    console.groupCollapsed(`[KNS Debug] ${step}`);
    console.log(JSON.stringify(data, null, 2));
    console.groupEnd();
  }

  async createDomainInscription(
    wallet: AppWallet,
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string
  ): Promise<{
    script: string;
    commitData: any;
    revealData: any;
    networkId: string;
  }> {
    console.groupCollapsed('[KNS Domain Inscription]');
    console.log('Starting domain inscription for:', domain);
    console.log('Public Key:', publicKey.toString());
    console.log('Network:', network);
    console.log('UTXO Entries:', entries);
    // Debug script for browser console
    const debugScript = `
      console.groupCollapsed('[KNS Debug Script]');
      console.log('Run this in console to debug commit-reveal:');
      console.log(\`
        async function debugCommitReveal() {
          try {
            const wallet = window.kasware.getCurrentWallet();
            const domain = prompt('Enter domain (1-5 chars):');
            if (!domain || domain.length < 1 || domain.length > 5) {
              throw new Error('Invalid domain length');
            }
            
            const entries = await wallet.getUtxoEntries();
            const address = await wallet.getAddress();
            const publicKey = await wallet.getPublicKey(address);
            const network = await wallet.getNetwork();
            
            console.groupCollapsed('[Commit Details]');
            console.log('Domain:', domain);
            console.log('Entries:', entries);
            console.log('Address:', address);
            console.log('Public Key:', publicKey);
            console.log('Network:', network);
            console.groupEnd();
            
            const result = await window.knsService.createDomainInscription(
              wallet,
              domain,
              publicKey,
              entries,
              address,
              network
            );
            
            console.groupCollapsed('[Result Details]');
            console.log('Script:', result.script);
            console.log('Commit Data:', result.commitData);
            console.log('Reveal Data:', result.revealData);
            console.log('Network ID:', result.networkId);
            console.groupEnd();
            
            return result;
          } catch (error) {
            console.error('Commit-Reveal Error:', error);
            throw error;
          }
        }
        debugCommitReveal().then(console.log).catch(console.error);
      \`);
      console.groupEnd();
    `;
    
    // Execute debug script
    eval(debugScript);
    // Validate domain length (1-5 characters)
    if (domain.length < 1 || domain.length > 5) {
      throw new Error('Domain length must be between 1 and 5 characters');
    }

    // Format inscription data according to KNS spec
    const inscriptionData: DomainInscriptionData = {
      op: "create",
      p: "domain",
      v: domain,
      s: "kas" // Default to .kas suffix
    };

    // Convert inscription data to compact JSON (no whitespace)
    const compactInscriptionData = JSON.stringify(inscriptionData, null, 0);
    console.log('Inscription Data:', compactInscriptionData);

    const script = this.createInscriptionScript(publicKey, inscriptionData);
    const fee = this.calculateFee(domain.length);
    console.log('Domain Length:', domain.length, 'Fee:', fee);

    // Hard-coded KNS receiving address for testnet 10
    const p2shAddress = 'kaspatest:qq9h47etjv6x8jgcla0ecnp8mgrkfxm70ch3k60es5a50ypsf4h6sak3g0lru';

    let networkId = 'testnet-10';
    switch (network) {
      case 'kaspa_mainnet':
        networkId = 'mainnet';
        break;
      case 'kaspa_testnet_11':
        networkId = 'testnet-11';
        break;
      case 'kaspa_testnet_10':
        networkId = 'testnet-10';
        break;
      case 'kaspa_devnet':
        networkId = 'devnet';
        break;
    }

    // Ensure amounts are numbers
    const commitAmount = 1; // 1 sompi for dust output
    const revealAmount = Number(fee);

    if (isNaN(revealAmount)) {
      throw new Error('Invalid fee amount');
    }

    // Structure the transactions according to Kasware's expected format
    // Increase dust amount and simplify output structure
    const commitData = {
      entries,
      outputs: [{
        address,
        amount: 100 // Increased from 1 to 100 sompi for dust threshold
      }],
      changeAddress: address,
      priorityFee: 0.01,
      type: 'commit',
      inscriptionProtocol: 'domain'
    };

    const revealData = {
      outputs: [{
        address: p2shAddress,
        amount: revealAmount
      }],
      changeAddress: address,
      priorityFee: 0.02,
      type: 'reveal',
      inscriptionProtocol: 'domain'
    };

    // Log the final data structures before returning
    console.log('Commit Data:', JSON.stringify(commitData, null, 2));
    console.log('Reveal Data:', JSON.stringify(revealData, null, 2));
    console.log('Network ID:', networkId);
    console.log('Script:', script.toString());

    return {
      script: script.toString(),
      commitData,
      revealData,
      networkId,
    };
  }

  private calculateFee(domainLength: number): number {
    // Convert KAS to Sompi (1 KAS = 100,000,000 Sompi)
    const kasToSompi = (kas: number) => kas * 100000000;
    
    if (domainLength === 1) return kasToSompi(6);
    if (domainLength === 2) return kasToSompi(5);
    if (domainLength === 3) return kasToSompi(4);
    if (domainLength === 4) return kasToSompi(3);
    return kasToSompi(2);
  }

  private createInscriptionScript(
    publicKey: XOnlyPublicKey,
    inscriptionData: DomainInscriptionData
  ): ScriptBuilder {
    const pubKeyHex = publicKey.toString();
    const pubKeyBytes = this.hexToBytes(pubKeyHex);

    return new ScriptBuilder()
      .addData(pubKeyBytes)
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(this.toUint8Array('kns'))
      .addI64(0n)
      .addData(this.toUint8Array(JSON.stringify(inscriptionData, null, 0)))
      .addOp(Opcodes.OpEndIf);
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private async verifyDomainOwnership(domain: string, ownerAddress: string): Promise<DomainVerificationResult> {
    try {
      const response = await fetch(`https://api.knsdomains.org/tn10/api/v1/${domain}/owner`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        return { success: false, message: data.message };
      }
      
      if (data.data.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
        return { success: false, message: 'Address does not match domain owner' };
      }
      
      return { success: true, data: data.data };
    } catch (error) {
      console.error('Domain verification failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async prepareDomainRegistration(
    domain: string,
    publicKey: XOnlyPublicKey,
    ownerAddress: string,
    network: string
  ): Promise<DomainRegistrationRequest> {
    const fee = this.calculateFee(domain.length);
    return {
      domain,
      ownerAddress,
      publicKey: publicKey.toString(),
      network,
      fee
    };
  }

  async processBackendResponse(response: DomainRegistrationResponse): Promise<{
    script: string;
    commitData: any;
    revealData: any;
  }> {
    return {
      script: response.script,
      commitData: response.commitTx,
      revealData: response.revealTx
    };
  }

  async registerDomain(
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string,
    submitTx: (
      commit: any,
      reveal: any,
      script: string,
      networkId: string,
      options?: any
    ) => Promise<CommitRevealResult>,
    backendRequest: (
      request: DomainRegistrationRequest
    ) => Promise<DomainRegistrationResponse>
  ): Promise<CommitRevealResult> {
    console.groupCollapsed('[KNS Register Domain] Starting Domain Registration');
    console.log('Domain:', domain);
    console.log('Public Key:', publicKey.toString());
    console.log('Network:', network);
    console.log('Address:', address);
    console.log('UTXO Entries:', entries);
    console.groupEnd();

    try {
    console.groupCollapsed('[KNS Register Domain] Commit-Reveal Details');
    console.log('Domain:', domain);
    console.log('Public Key:', publicKey.toString());
    console.log('Network:', network);
    console.log('Address:', address);
    console.log('UTXO Entries:', entries);
    console.groupCollapsed('[KNS Register Domain]');
    console.log('Starting domain registration for:', domain);
    console.log('Public Key:', publicKey.toString());
    console.log('Network:', network);
    console.log('UTXO Entries:', entries);
    const maxRetries = 3;
    const initialDelay = 1000; // 1 second
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Verify domain ownership
        const verification = await this.verifyDomainOwnership(domain, address);
        if (!verification.success) {
          throw new Error(`Domain verification failed: ${verification.message}`);
        }

        // Prepare registration request
        const registrationRequest = await this.prepareDomainRegistration(
          domain,
          publicKey,
          address,
          network
        );

        // Send to backend with retry
        const backendResponse = await this.retryWithBackoff(
          () => backendRequest(registrationRequest),
          initialDelay,
          maxRetries
        );

        // Process backend response
        const { script, commitData, revealData } = 
          await this.processBackendResponse(backendResponse);

        // Submit transaction through Kasware with retry
        console.groupCollapsed('[KNS Register Domain] Commit-Reveal Transaction Details');
        console.log('Commit Data:', JSON.stringify(commitData, null, 2));
        console.log('Reveal Data:', JSON.stringify(revealData, null, 2));
        console.log('Script:', script);
        console.log('Network:', network);
        console.groupEnd();

        const result = await this.retryWithBackoff(
          () => submitTx(commitData, revealData, script, network, {
            inscriptionProtocol: 'domain'
          }),
          initialDelay,
          maxRetries
        );

        console.groupCollapsed('[KNS Register Domain] Transaction Results');
        console.log('Commit Tx ID:', result.commitTxId);
        console.log('Reveal Tx ID:', result.revealTxId);
        console.groupEnd();

        return result;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

      throw new Error('Max retries exceeded for domain registration');
    } catch (error) {
      console.error('[KNS Register Domain] Error:', error);
      throw error;
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    initialDelay: number,
    maxRetries: number
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async createBinaryInscription(
    wallet: AppWallet,
    fileData: Uint8Array,
    mimeType: string,
    priorityFee: bigint = 0n
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: ICreateTransactions;
  }> {
    // Convert binary data to hex string
    const hexData = Array.from(fileData)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    const script = new ScriptBuilder()
      .addData(wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString() as HexString)
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(this.toUint8Array('kns'))
      .addOp(1)
      .addOp(1)
      .addData(this.toUint8Array(mimeType))
      .addI64(0n)
      .addData(this.toUint8Array(hexData))
      .addOp(Opcodes.OpEndIf);

    const scriptAddress = addressFromScriptPublicKey(
      script.createPayToScriptHashScript(),
      this.rpcService.getNetwork()
    );

    if (!scriptAddress) {
      throw new Error('Failed to create binary inscription script address');
    }

    const outputs = [{
      address: scriptAddress.toString(),
      amount: KASPA_AMOUNT_FOR_KRC20_ACTION
    }];

    return await this.doTransactionWithUtxoProcessor(
      wallet.getUtxoProcessorManager()!,
      wallet.getPrivateKey(),
      priorityFee,
      outputs,
      {
        notifyCreatedTransactions: async (txId) => {
          console.log('Binary inscription transaction created:', txId);
        }
      }
    );
  }

  private calculateDomainFee(length: number): bigint {
    // Domain fee calculation based on character length
    const fees: { [key: number]: bigint } = {
      1: 6n,
      2: 5n,
      3: 4n,
      4: 3n,
      5: 2n
    };

    // Default to lowest fee for longer domains
    const fee = fees[length] || 2n;
    
    // Convert to Kaspa units (assuming fee is in whole Kaspa)
    return fee * BigInt(1e8); // 1 Kaspa = 100000000 sompi
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
