import { KaspaNetworkTransactionsManagerService, SUBMIT_REVEAL_MIN_UTXO_AMOUNT } from './kaspa-network-transactions-manager.service';
import {
  IFeeEstimate,
  IPaymentOutput,
  IScriptPublicKey,
  Mnemonic,
  PrivateKey,
  ScriptPublicKey,
  UtxoEntryReference,
  XPrv,
} from '../../../../public/kaspa/kaspa';
import { Injectable, Signal } from '@angular/core';
import { DEFAULT_DERIVED_PATH, LOCAL_STORAGE_KEYS } from '../../config/consts';
import {
  CommitRevealActionResult,
  ERROR_CODES,
  KasTransferActionResult,
  ProtocolScriptDataAndAddress,
  WalletActionResult,
  WalletActionResultType,
} from 'kaspacom-wallet-messages';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import {
  SignPsktTransactionAction,
  CommitRevealAction,
  SignMessage,
  TransferKasAction,
  WalletAction,
  WalletActionType,
} from '../../types/wallet-action';
import { AppWallet } from '../../classes/AppWallet';
import {
  SignPsktTransactionActionResult,
  CompoundUtxosActionResult,
  SignedMessageActionResult,
} from '../../types/wallet-action-result';
import {
  Krc20OperationDataService,
} from '../protocols/krc20/krc20-operation-data.service';
import { UnfinishedCommitRevealAction } from '../../types/kaspa-network/unfinished-commit-reveal-action.interface';
import { PsktTransaction } from '../../types/kaspa-network/pskt-transaction.interface';
import { UtilsHelper } from '../utils.service';
import { ProtocolType } from 'kaspacom-wallet-messages/dist/types/protocol-type.enum';

const MINIMAL_TRANSACTION_MASS = 10000n;
export const MINIMAL_AMOUNT_TO_SEND = 20000000n;
export const MAX_TRANSACTION_FEE = 20000n;
export const REVEAL_PSKT_AMOUNT = 105000000n;

const ESTIMATED_REVEAL_ACTION = 1715n;
@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManager: KaspaNetworkTransactionsManagerService,
    private readonly krc20OperationDataService: Krc20OperationDataService,
    private readonly utils: UtilsHelper
  ) { }

  async connectAndDo<T>(
    fn: () => Promise<T>,
    attempts: number = Infinity
  ): Promise<T> {
    return await this.transactionsManager.connectAndDo<T>(fn, attempts);
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.transactionsManager.getConnectionStatusSignal();
  }

  async getWalletBalanceAndUtxos(walletAddres: string) {
    return await this.transactionsManager.getWalletTotalBalanceAndUtxos(
      walletAddres
    );
  }

  kaspaToSompiFromNumber(value: number): bigint {
    return BigInt(
      Math.round(value * 1e8).toLocaleString('fullwide', { useGrouping: false })
    );
  }

  sompiToNumber(value: bigint): number {
    return Number(value) / 1e8;
  }

  convertPrivateKeyToAddress(privateKey: string): string {
    return this.transactionsManager.convertPrivateKeyToAddress(privateKey);
  }

  validatePrivateKey(privateKey: string) {
    try {
      new PrivateKey(privateKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  getPrivateKeyFromMnemonic(
    mnemonicWords: string,
    derivedPath: string = DEFAULT_DERIVED_PATH,
    password?: string
  ): string | null {
    const isValid = Mnemonic.validate(mnemonicWords);

    if (!isValid) {
      return null;
    }

    const mnemonic = new Mnemonic(mnemonicWords);

    const seed = mnemonic.toSeed(password);
    const xprv = new XPrv(seed);

    if (derivedPath) {
      return xprv.derivePath(derivedPath).toPrivateKey().toString();
    }

    return xprv.privateKey;
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string
  ): string | null {
    const privateKey = this.getPrivateKeyFromMnemonic(
      mnemonic,
      DEFAULT_DERIVED_PATH,
      password
    );
    return privateKey ? this.convertPrivateKeyToAddress(privateKey) : null;
  }

  generateMnemonic(wordsCount: number): string {
    return Mnemonic.random(wordsCount).phrase;
  }

  async initUtxoProcessorManager(
    address: string,
    onBalanceUpdate: () => Promise<any>
  ): Promise<UtxoProcessorManager> {
    return await this.transactionsManager.initUtxoProcessorManager(
      address,
      onBalanceUpdate
    );
  }

  // Should be synced with doWalletAction
  async estimateWalletActionMass(
    action: WalletAction,
    wallet: AppWallet
  ): Promise<bigint[]> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      const actionData = action.data as TransferKasAction;
      const payments: IPaymentOutput[] = [
        {
          address: actionData.to,
          amount: actionData.amount,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          actionData.sendAll,
          async () => { },
          true
        );

      if (!result.success) {
        throw new Error('Failed to estimate transaction mass');
      }

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type == WalletActionType.COMPOUND_UTXOS) {
      await wallet.getUtxoProcessorManager()?.waitForPendingUtxoToFinish();

      const payments: IPaymentOutput[] = [
        {
          address: wallet.getAddress(),
          amount: 0n,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          true,
          async () => { },
          true
        );

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type == WalletActionType.SIGN_PSKT_TRANSACTION) {
      const result =
        await this.transactionsManager.signPsktTransaction(
          wallet,
          (action.data as SignPsktTransactionAction).psktTransactionJson,
          action.priorityFee || 0n,
          false,
        );

      if (!result.transactionFee) {
        throw new Error('Failed to estimate transaction mass');
      }

      return [result.transactionFee];
    }

    if (action.type == WalletActionType.COMMIT_REVEAL) {

      const result =
        await this.transactionsManager.doCommitRevealActionTransactionsAndNotifyWithUtxoProcessor(
          wallet,
          action.data.actionScript.type,
          action.data.actionScript.stringifyAction,
          action.data.options?.revealPriorityFee || 0n,
          action.priorityFee || 0n,
          { commitTransactionId: action.data.options?.commitTransactionId },
          async () => { },
          { estimateOnly: true },
          action.data.options?.additionalOutputs,
        );

      return [
        ...(result.result!.commitMass || []),
        ...(result.result!.revealMass || []),
        ...(action.data.options?.commitTransactionId ? [] : [BigInt((action.data.options?.additionalOutputs?.length || 0) + 1) * ESTIMATED_REVEAL_ACTION]),
      ];
    }

    throw new Error('No such action type');
  }

  // Shoult be synced with estimateWalletActionMass
  async doWalletAction(
    action: WalletAction,
    wallet: AppWallet,
    notifyUpdate: (transactionId: string) => Promise<any>
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: WalletActionResult;
  }> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      const actionData = action.data as TransferKasAction;
      const payments: IPaymentOutput[] = [
        {
          address: actionData.to,
          amount: actionData.amount,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          actionData.sendAll,
          notifyUpdate
        );

      const actionResult: KasTransferActionResult = {
        amount: actionData.amount,
        to: actionData.to,
        sendAll: actionData.sendAll,
        transactionId: result.result!.summary.finalTransactionId!,
        performedByWallet: wallet.getAddress(),
        type: WalletActionResultType.KasTransfer,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type == WalletActionType.COMPOUND_UTXOS) {
      await wallet.getUtxoProcessorManager()?.waitForPendingUtxoToFinish();

      if ((wallet.getBalanceSignal()()?.utxoEntries.length || 0) < 2) {
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.NO_UTXOS_TO_COMPOUND,
        };
      }

      const payments: IPaymentOutput[] = [
        {
          address: wallet.getAddress(),
          amount: 0n,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          true,
          notifyUpdate
        );

      const actionResult: CompoundUtxosActionResult = {
        transactionId: result.result!.summary.finalTransactionId!,
        performedByWallet: wallet.getAddress(),
        type: WalletActionResultType.CompoundUtxos,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type == WalletActionType.SIGN_PSKT_TRANSACTION) {
      const result =
        await this.transactionsManager.signPsktTransaction(
          wallet,
          action.data.psktTransactionJson,
          action.priorityFee || 0n,
          action.data.submitTransaction
        );

      const resultData: SignPsktTransactionActionResult = {
        type: WalletActionResultType.SignPsktTransaction,
        psktTransactionJson: result.psktTransaction,
        transactionId: result.transactionId,
        performedByWallet: wallet.getAddress(),
      };

      return {
        success: true,
        result: resultData,
      };
    }

    if (action.type == WalletActionType.SIGN_MESSAGE) {
      const result = await this.transactionsManager.signMessage(
        wallet.getPrivateKey(),
        (action.data as SignMessage).message
      );

      const resultData: SignedMessageActionResult = {
        type: WalletActionResultType.MessageSigning,
        performedByWallet: wallet.getAddress(),
        originalMessage: (action.data as SignMessage).message,
        signedMessage: result.signedMessage,
        publicKey: result.publickey,
      };

      return {
        success: true,
        result: resultData,
      };
    }

    if (action.type === WalletActionType.COMMIT_REVEAL) {
      const actionData: CommitRevealAction = action.data as CommitRevealAction;
      const revealPriorityFee = actionData.options?.revealPriorityFee || 0n;

      const result =
        await this.transactionsManager.doCommitRevealActionTransactionsAndNotifyWithUtxoProcessor(
          wallet,
          actionData.actionScript.type,
          actionData.actionScript.stringifyAction,
          revealPriorityFee,
          action.priorityFee || 0n,
          { commitTransactionId: actionData.options?.commitTransactionId },
          async (transactions) => {
            if (!transactions.revealTransactionId) {
              const newActionsData = { ...actionData };
              newActionsData.options = { ...newActionsData.options || {} };
              newActionsData.options.commitTransactionId = transactions.commitTransactionId;

              await this.addUnfinishedCommitRevealActionOnLocalStorage({
                createdAtTimestamp: Date.now(),
                operationData: newActionsData,
                walletAddress: wallet.getAddress(),
              });
            }
            notifyUpdate(transactions.revealTransactionId || transactions.commitTransactionId!);
          },
          {},
          actionData.options?.additionalOutputs,
        );

      if (!result.success) {
        console.error('Failed do KRC20 action', result);
        return {
          success: false,
          errorCode: result.errorCode,
        };
      }

      await this.removeUnfinishedActionOnLocalStorage({
        operationData: actionData,
        walletAddress: wallet.getAddress(),
        createdAtTimestamp: Date.now(),
      }, actionData.options?.commitTransactionId || result.result?.commit!);

      let psktTransaction: string | undefined;

      if (actionData.options?.revealPskt) {
        psktTransaction = (await this.transactionsManager.createPsktTransactionForRevealOperation(
          wallet,
          actionData.options!.revealPskt!.script,
          result.result?.reveal!,
          actionData.options!.revealPskt!.outputs,
        )).serializeToSafeJSON();
      }


      const actionResult: CommitRevealActionResult = {
        type: WalletActionResultType.CommitReveal,
        commitTransactionId: actionData.options?.commitTransactionId || result.result?.commit!,
        revealTransactionId: result.result?.reveal!,
        performedByWallet: wallet.getAddress(),
        protocol: actionData.actionScript.type,
        protocolAction: actionData.actionScript.stringifyAction,
        revealPsktJson: psktTransaction,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    return {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };
  }

  async getMinimalRequiredAmountForAction(
    action: WalletAction
  ): Promise<bigint> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      return (
        (action.data as TransferKasAction).amount +
        (action.priorityFee || 0n) +
        MINIMAL_TRANSACTION_MASS
      );
    }

    if (action.type === WalletActionType.COMPOUND_UTXOS) {
      return (action.priorityFee || 0n) + MINIMAL_AMOUNT_TO_SEND;
    }

    if (action.type === WalletActionType.SIGN_PSKT_TRANSACTION) {
      const data = action.data as SignPsktTransactionAction;
      const pskt: PsktTransaction = JSON.parse(data.psktTransactionJson);

      const totalOutputs = pskt.outputs.reduce(
        (acc, curr) => acc + BigInt(curr.value),
        0n
      );

      return (action.priorityFee || 0n) + totalOutputs + MINIMAL_AMOUNT_TO_SEND;
    }

    if (action.type == WalletActionType.COMMIT_REVEAL) {
      const actionData = action.data;

      const additionalOutputsSum = actionData.options?.additionalOutputs?.reduce(
        (acc, curr) => acc + curr.amount,
        0n
      ) || 0n;

      const additionalPriorityFee = actionData.options?.revealPriorityFee || 0n;

      return (action.priorityFee || 0n) * 2n +
        MINIMAL_TRANSACTION_MASS * 2n +
        SUBMIT_REVEAL_MIN_UTXO_AMOUNT +
        additionalOutputsSum +
        additionalPriorityFee;
    }

    throw new Error('Invalid action type');
  }

  getWalletAddressFromScriptPublicKey(scriptPublicKey: string | IScriptPublicKey | ScriptPublicKey): string {
    return this.transactionsManager.getWalletAddressFromScriptPublicKey(
      scriptPublicKey
    );
  }

  async getEstimateFeeRates(): Promise<IFeeEstimate> {
    return await this.transactionsManager.getEstimateFeeRates();
  }


  async updateUnfinishedCommitRevealActionOnLocalStorage(
    updateFunction: (
      data: UnfinishedCommitRevealAction[]
    ) => Promise<UnfinishedCommitRevealAction[]>
  ): Promise<void> {
    const actions = this.getUnfinishedCommitRevealActions();
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_COMMIT_REVEAL_ACTIONS,
      this.utils.stringifyWithBigInt(await updateFunction(actions))
    );
  }

  async addUnfinishedCommitRevealActionOnLocalStorage(
    action: UnfinishedCommitRevealAction
  ): Promise<void> {
    await this.updateUnfinishedCommitRevealActionOnLocalStorage(async (data) => {
      data.push(action);

      return data;
    });
  }

  async removeUnfinishedActionOnLocalStorage(
    action: UnfinishedCommitRevealAction,
    commitTransactionId: string,
  ): Promise<void> {
    await this.updateUnfinishedCommitRevealActionOnLocalStorage(async (data) => {
      const index = data.findIndex(
        (item) =>
          this.utils.stringifyWithBigInt(item.operationData.actionScript) ===
          this.utils.stringifyWithBigInt(action.operationData.actionScript) &&
          action.walletAddress == item.walletAddress &&
          commitTransactionId == item.commitTransactionId
      );
      if (index !== -1) {
        data.splice(index, 1);
      }

      return data;
    });
  }

  async getWalletUnfinishedActions(
    wallet: AppWallet,
    timeAgo: number = 2 * 60 * 1000
  ): Promise<UnfinishedCommitRevealAction | undefined> {
    let actions = this.getUnfinishedCommitRevealActions();
    let walletUnfinishedActions = actions.filter(
      (item) =>
        item.walletAddress === wallet.getAddress() &&
        item.createdAtTimestamp < Date.now() - timeAgo
    );
    let currentUnfinishedAction: UnfinishedCommitRevealAction | undefined = undefined;

    while (walletUnfinishedActions.length > 0 && !currentUnfinishedAction) {
      currentUnfinishedAction = walletUnfinishedActions[0];

      const utxoEntry = await this.doesUnfinishedActionHasKasInScriptWallet(
        wallet,
        currentUnfinishedAction.operationData
      );

      if (utxoEntry) {
        currentUnfinishedAction.commitTransactionId = utxoEntry.outpoint.transactionId;
        break;
      } else {
        await this.removeUnfinishedActionOnLocalStorage(
          currentUnfinishedAction,
          currentUnfinishedAction.commitTransactionId!,
        );
        currentUnfinishedAction = undefined;
      }

      actions = this.getUnfinishedCommitRevealActions();
      walletUnfinishedActions = actions.filter(
        (item) => item.walletAddress === wallet.getAddress()
      );
    }

    return currentUnfinishedAction;
  }

  getUnfinishedCommitRevealActions(): UnfinishedCommitRevealAction[] {
    const totalActionsJson = localStorage.getItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_COMMIT_REVEAL_ACTIONS
    );
    const totalActions = this.utils.parseWithBigInt(
      totalActionsJson || '[]'
    ) as UnfinishedCommitRevealAction[];
    return totalActions;
  }

  async doesUnfinishedActionHasKasInScriptWallet(
    wallet: AppWallet,
    action: CommitRevealAction
  ): Promise<UtxoEntryReference> {
    const script = this.transactionsManager.createGenericScriptFromString(
      action.actionScript.type,
      action.actionScript.stringifyAction,
      wallet.getAddress()
    );


    let utxos = (await this.transactionsManager.getWalletTotalBalanceAndUtxos(
      script.scriptAddress.toString()
    )).utxoEntries;

    if (action.options?.commitTransactionId) {
      utxos = utxos.filter(
        (utxo) => utxo.outpoint.transactionId == action.options!.commitTransactionId
      )
    }

    return utxos[0];
  }


  createGenericScriptFromString(
    type: ProtocolType | string,
    stringifyAction: string,
    walletAddress: string
  ): ProtocolScriptDataAndAddress {
    return this.transactionsManager.createGenericScriptFromString(
      type,
      stringifyAction,
      walletAddress
    );
  }
}
