import { Injectable, NgModule, Signal } from '@angular/core';
import {
  addressFromScriptPublicKey,
  createTransactions,
  FeeSource,
  ICreateTransactions,
  IFees,
  IGeneratorSettingsObject,
  IPaymentOutput,
  IUtxoEntry,
  Opcodes,
  PendingTransaction,
  PrivateKey,
  ScriptBuilder,
  UtxoEntryReference,
  UtxoProcessor,
} from '../../../../public/kaspa/kaspa';
import { RpcService } from './rpc.service';
import { KaspaNetworkConnectionManagerService } from './kaspa-network-connection-manager.service';
import { UtilsHelper } from '../utils.service';
import { KRC20OperationDataInterface } from '../../types/kaspa-network/krc20-operations-data.interface';
import { TotalBalanceWithUtxosInterface } from '../../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoContextProcessorInterface } from '../../types/kaspa-network/utxo-context-processor.interface';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import { ERROR_CODES } from '../../config/consts';
import { MINIMAL_AMOUNT_TO_SEND } from './kaspa-network-actions.service';
import { AppWallet } from '../../classes/AppWallet';

// export const MINIMAL_AMOUNT_TO_SEND = kaspaToSompi('0.2');
const TIME_TO_WAIT_BEFORE_TRANSACTION_RECEIVED_CHECK = 120 * 1000;
const NUMBER_OF_MINUTES_TO_KEEP_CHECKING_TRANSACTION_RECEIVED = 25 * 12;

type DoTransactionOptions = {
  notifyCreatedTransactions?: (transactionId: string) => Promise<any>;
  specialSignTransactionFunc?: (
    transaction: PendingTransaction
  ) => Promise<any>;
  additionalKrc20TransactionPriorityFee?: bigint;
  priorityEntries?: IUtxoEntry[];
  sendAll?: boolean;
  stopOnApplicationClosing?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private readonly rpcService: RpcService,
    private readonly connectionManager: KaspaNetworkConnectionManagerService,
    private readonly utils: UtilsHelper
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

  createP2SHAddressScript(
    data: KRC20OperationDataInterface,
    privateKey: PrivateKey
  ) {
    const script = new ScriptBuilder()
      .addData(privateKey.toPublicKey().toXOnlyPublicKey().toString())
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(Buffer.from('kasplex'))
      .addI64(0n)
      .addData(Buffer.from(JSON.stringify(data)))
      .addOp(Opcodes.OpEndIf);

    const scriptAddress = addressFromScriptPublicKey(
      script.createPayToScriptHashScript(),
      this.rpcService.getNetwork()
    );

    return {
      script: script,
      p2shaAddress: scriptAddress,
    };
  }

  async initUtxoProcessorManager(
    address: string
  ): Promise<UtxoProcessorManager> {
    return await this.connectAndDo(async () => {
      const utxoProcessonManager = new UtxoProcessorManager(
        this.rpcService.getRpc()!,
        this.rpcService.getNetwork(),
        address
      );

      await utxoProcessonManager.init();

      return utxoProcessonManager;
    });
  }

  //   async calculateTransactionFeeAndLimitToMax(transactionData, maxPriorityFee): Promise<FeesCalculation> {
  //     const finalFees = await this.utils.retryOnError(async () => {
  //       const currentTransaction = await createTransactions(transactionData);

  //       // console.log('calculateTransactionFeeAndLimitToMax', currentTransaction.summary);

  //       const fees = await this.getTransactionFees(currentTransaction);

  //       return fees;
  //     });

  //     if (finalFees.priorityFee > maxPriorityFee) {
  //       throw new PriorityFeeTooHighError();
  //     }

  //     return finalFees;
  //   }

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

      const baseTransactionData: IGeneratorSettingsObject = {
        priorityEntries: additionalOptions.priorityEntries || [],
        entries: context,
        outputs,
        changeAddress: this.convertPrivateKeyToAddress(privateKey.toString()),
        priorityFee: {
          amount: additionalKrc20TransactionPriorityFee + priorityFee,
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
              //   additionalOptions.stopOnApplicationClosing
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
    notifyCreatedTransactions?: (transactionId: string) => Promise<any>
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
      }
    );
  }

  //   async doKrc20CommitTransactionWithUtxoProcessor(
  //     privateKey: PrivateKey,
  //     krc20transactionData: KRC20OperationDataInterface,
  //     maxPriorityFee: bigint = 0n,
  //     baseTransactionAmount = KRC20_BASE_TRANSACTION_AMOUNT,
  //     notifyCreatedTransactions: (transactionId: string) => Promise<any> = null,
  //     stopOnApplicationClosing: boolean = false,
  //   ) {
  //     const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

  //     const outputs = [
  //       {
  //         address: scriptAndScriptAddress.p2shaAddress.toString(),
  //         amount: baseTransactionAmount,
  //       },
  //     ];

  //     return await this.doTransactionWithUtxoProcessor(privateKey, maxPriorityFee, outputs, {
  //       notifyCreatedTransactions,
  //       stopOnApplicationClosing,
  //     });
  //   }

  //   async doKrc20RevealTransactionWithUtxoProcessor(
  //     privateKey: PrivateKey,
  //     krc20transactionData: KRC20OperationDataInterface,
  //     transactionFeeAmount: bigint,
  //     maxPriorityFee: bigint = 0n,
  //     notifyCreatedTransactions: (transactionId: string) => Promise<any> = null,
  //     stopOnApplicationClosing: boolean = false,
  //   ) {
  //     const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

  //     const revealUTXOs = await this.connectAndDo<IGetUtxosByAddressesResponse>(async () => {
  //       return await this.rpcService.getRpc().getUtxosByAddresses({
  //         addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
  //       });
  //     });

  //     const priorityEntries = [revealUTXOs.entries[0]];

  //     const specialSignTransactionFunc = async (transaction: PendingTransaction) => {
  //       transaction.sign([privateKey], false);
  //       const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

  //       if (ourOutput !== -1) {
  //         const signature = await transaction.createInputSignature(ourOutput, privateKey);

  //         transaction.fillInput(ourOutput, scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(signature));
  //       }
  //     };

  //     const outputs = [];

  //     return await this.doTransactionWithUtxoProcessor(privateKey, maxPriorityFee, outputs, {
  //       notifyCreatedTransactions,
  //       specialSignTransactionFunc,
  //       additionalKrc20TransactionPriorityFee: transactionFeeAmount,
  //       priorityEntries,
  //       stopOnApplicationClosing,
  //     });
  //   }

  //   // ================================================================
  //   // OTHER
  //   // ================================================================

  //   /**
  //    *
  //    * @param privateKey To Send From
  //    * @param priorityFee Will Aplly twice for both transactions
  //    * @param transactionData Krc20 Command Data
  //    * @param transactionFeeAmount transfer - minimal, mint - 1kas, deploy - 1000kas
  //    * @returns reveal transaction id
  //    */
  //   async createKrc20TransactionAndDoReveal(
  //     privateKey: PrivateKey,
  //     krc20transactionData: KRC20OperationDataInterface,
  //     transactionFeeAmount: bigint,
  //     maxPriorityFee: bigint = 0n,
  //   ): Promise<Krc20TransactionsResult> {
  //     const commitTransaction = await this.doKrc20CommitTransaction(privateKey, krc20transactionData, maxPriorityFee);

  //     const revealTransaction = await this.doKrc20RevealTransaction(
  //       privateKey,
  //       krc20transactionData,
  //       transactionFeeAmount,
  //       maxPriorityFee,
  //     );

  //     return {
  //       commitTransactionId: commitTransaction.summary.finalTransactionId,
  //       revealTransactionId: revealTransaction.summary.finalTransactionId,
  //     };
  //   }

  convertPrivateKeyToAddress(privateKey: string): string {
    return new PrivateKey(privateKey)
      .toPublicKey()
      .toAddress(this.rpcService.getNetwork())
      .toString();
  }

  //   async getEstimatedPriorityFeeRate(): Promise<number> {
  //     const estimatedFees = await this.rpcService.getRpc().getFeeEstimate({});

  //     return estimatedFees.estimate.priorityBucket.feerate;
  //   }

  //   async getTransactionFees(transactionData: ICreateTransactions): Promise<FeesCalculation> {
  //     const estimatedFeeRate = await this.getEstimatedPriorityFeeRate();
  //     const massAndFeeRate = BigInt(Math.ceil(Number(transactionData.summary.mass) * estimatedFeeRate));
  //     const maxFee = transactionData.summary.fees > massAndFeeRate ? transactionData.summary.fees : massAndFeeRate;

  //     const priorityFee = maxFee - transactionData.summary.fees < 0 ? 0n : maxFee - transactionData.summary.fees;

  //     return {
  //       originalFee: transactionData.summary.fees,
  //       mass: transactionData.summary.mass,
  //       maxFee: maxFee,
  //       priorityFee: priorityFee,
  //       estimatedNetworkFee: estimatedFeeRate,
  //     };
  //   }

  //   async getWalletTotalBalance(address: string): Promise<bigint> {
  //     const result = await this.getWalletTotalBalanceAndUtxos(address);
  //     return result.totalBalance;
  //   }

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
}
