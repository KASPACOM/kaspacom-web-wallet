import {
  KaspaNetworkTransactionsManagerService,
  SUBMIT_REVEAL_MIN_UTXO_AMOUNT,
} from './kaspa-network-transactions-manager.service';
import {
  IFeeEstimate,
  IPaymentOutput,
  IScriptPublicKey,
  Mnemonic,
  PrivateKey,
  ScriptPublicKey,
  UtxoEntryReference,
} from '../../../../public/kaspa/kaspa';
import { Injectable, Signal, inject } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';
import {
  CommitRevealActionResult,
  EIP1193ProviderRequestActionResult,
  EIP1193RequestPayload,
  EIP1193RequestType,
  ERROR_CODES,
  KasTransactionParams,
  KasTransferActionResult,
  ProtocolScriptDataAndAddress,
  ProtocolType,
  SignedMessageActionResult,
  SignPsktTransactionActionResult,
  WalletActionResult,
  WalletActionResultType,
} from '@kaspacom/wallet-messages';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import {
  SignPsktTransactionAction,
  CommitRevealAction,
  SignMessage,
  TransferKasAction,
  WalletAction,
  WalletActionType,
  CovenantDeployAction,
  CovenantSpendAction,
  CovenantCompletePartialAction,
} from '../../types/wallet-action';
import { AppWallet } from '../../classes/AppWallet';
import { CompoundUtxosActionResult } from '../../types/wallet-action-result';
import { UnfinishedCommitRevealAction } from '../../types/kaspa-network/unfinished-commit-reveal-action.interface';
import { PsktTransaction } from '../../types/kaspa-network/pskt-transaction.interface';
import { UtilsHelper } from '../utils.service';
import { MempoolTransactionManager } from '../../classes/MempoolTransactionManager';
import { TransactionRequest } from 'ethers';
import { createEIP1193Response } from '../etherium-services/create-eip-1193-response';
import { KaspaWalletMnemonicActionsService } from './kaspa-wallet-mnemonic-actions.service';
import { CovenantService } from '../covenant/covenant.service';
import {
  CovenantCompletePartialActionResult,
  CovenantDeployActionResult,
  CovenantSpendActionResult,
} from '../../types/wallet-action-result';

const MINIMAL_TRANSACTION_MASS = 10000n;
const COVENANT_ESTIMATED_TRANSACTION_MASS = 25000n;
const MINIMUM_FEE_PER_MASS = 100n;
export const MINIMAL_AMOUNT_TO_SEND = 20000000n;
export const MAX_TRANSACTION_FEE = 20000n;
export const REVEAL_PSKT_AMOUNT = 105000000n;

const ESTIMATED_REVEAL_ACTION = 1715n;
@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  private readonly transactionsManager = inject(
    KaspaNetworkTransactionsManagerService,
  );
  private readonly utils = inject(UtilsHelper);
  private readonly kaspaWalletMnemonicActions = inject(
    KaspaWalletMnemonicActionsService,
  );
  private readonly covenantService = inject(CovenantService);

  async connectAndDo<T>(
    fn: () => Promise<T>,
    attempts: number = Infinity,
  ): Promise<T> {
    return await this.transactionsManager.connectAndDo<T>(fn, attempts);
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.transactionsManager.getConnectionStatusSignal();
  }

  async getWalletBalanceAndUtxos(walletAddres: string) {
    return await this.transactionsManager.getWalletTotalBalanceAndUtxos(
      walletAddres,
    );
  }

  kaspaToSompiFromNumber(value: number): bigint {
    return BigInt(
      Math.round(value * 1e8).toLocaleString('fullwide', {
        useGrouping: false,
      }),
    );
  }

  sompiToNumber(value: bigint): number {
    return Number(value) / 1e8;
  }

  convertPrivateKeyToAddress(privateKey: string): string {
    return this.kaspaWalletMnemonicActions.convertPrivateKeyToAddress(
      privateKey,
    );
  }

  getPublicKey(privateKey: string): string {
    return this.kaspaWalletMnemonicActions.getPublicKey(privateKey);
  }

  async initUtxoProcessorManager(
    address: string,
  ): Promise<UtxoProcessorManager> {
    return await this.transactionsManager.initUtxoProcessorManager(address);
  }

  async initMempoolTransactionManager(
    address: string,
  ): Promise<MempoolTransactionManager> {
    return await this.transactionsManager.initMempoolTransactionManager(
      address,
    );
  }

  // Should be synced with doWalletAction
  async estimateWalletActionMass(
    action: WalletAction,
    wallet: AppWallet,
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
          async () => {},
          true,
        );

      if (!result.success) {
        throw new Error('Failed to estimate transaction mass');
      }

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type == WalletActionType.COMPOUND_UTXOS) {
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
          async () => {},
          true,
        );

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type == WalletActionType.SIGN_PSKT_TRANSACTION) {
      const result = await this.transactionsManager.signPsktTransaction(
        wallet,
        (action.data as SignPsktTransactionAction).psktTransactionJson,
        action.priorityFee || 0n,
        false,
        (action.data as SignPsktTransactionAction).signOnly,
        (action.data as SignPsktTransactionAction).signInputs,
      );

      if (!result.transactionMass) {
        throw new Error('Failed to estimate transaction mass');
      }

      return [result.transactionMass];
    }

    if (action.type === WalletActionType.EIP1193_PROVIDER_REQUEST) {
      const result = await this.transactionsManager.doEtherSigningTransaction(
        wallet,
        action.priorityFee || 0n,
        action.data.params[0] as TransactionRequest,
        action.data.params[1] as KasTransactionParams,
        true,
        true,
        true,
        async () => {},
        action.rbf,
      );

      return result.result!.transaction!.transactions.map((t) => t.mass);
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
          async () => {},
          { estimateOnly: true },
          action.data.options?.additionalOutputs,
        );

      return [
        ...(result.result!.commitMass || []),
        ...(result.result!.revealMass || []),
        ...(action.data.options?.commitTransactionId
          ? []
          : [
              BigInt(
                (action.data.options?.additionalOutputs?.length || 0) + 1,
              ) * ESTIMATED_REVEAL_ACTION,
            ]),
      ];
    }

    if (
      action.type === WalletActionType.COVENANT_DEPLOY ||
      action.type === WalletActionType.COVENANT_SPEND ||
      action.type === WalletActionType.COVENANT_COMPLETE_PARTIAL
    ) {
      try {
        return [
          this.feeToPriorityFeeComponentMass(
            await this.estimateCovenantActionFee(action, wallet),
          ),
        ];
      } catch (error) {
        console.warn('[Covenant] Fee estimation failed:', error);
        return [COVENANT_ESTIMATED_TRANSACTION_MASS];
      }
    }

    throw new Error('No such action type');
  }

  // Shoult be synced with estimateWalletActionMass
  async doWalletAction(
    action: WalletAction,
    wallet: AppWallet,
    notifyUpdate: (transactionId: string) => Promise<any>,
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
          notifyUpdate,
          false,
          action.rbf,
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
          notifyUpdate,
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
      const result = await this.transactionsManager.signPsktTransaction(
        wallet,
        action.data.psktTransactionJson,
        action.priorityFee || 0n,
        action.data.submitTransaction,
        (action.data as SignPsktTransactionAction).signOnly,
        (action.data as SignPsktTransactionAction).signInputs,
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

    if (
      action.type == WalletActionType.EIP1193_PROVIDER_REQUEST &&
      action.data.method == EIP1193RequestType.KAS_SEND_TRANSACTION
    ) {
      const result = await this.transactionsManager.doEtherSigningTransaction(
        wallet,
        action.priorityFee || 0n,
        action.data.params[0] as TransactionRequest,
        action.data.params[1] as KasTransactionParams,
        true,
        true,
        false,
        notifyUpdate,
        action.rbf,
      );

      const resultData: EIP1193ProviderRequestActionResult<EIP1193RequestType.KAS_SEND_TRANSACTION> =
        {
          type: WalletActionResultType.EIP1193ProviderRequest,
          performedByWallet: wallet.getIdWithAccount(),
          requestData:
            action.data as EIP1193RequestPayload<EIP1193RequestType.KAS_SEND_TRANSACTION>,
          eip1193Response:
            createEIP1193Response<EIP1193RequestType.KAS_SEND_TRANSACTION>({
              kaspatransactionId:
                result.result!.transaction?.summary.finalTransactionId,
              ethTransactionHash: result.result!.signedTransactionHash,
            }),
        };

      return {
        success: true,
        result: resultData,
      };
    }

    if (action.type == WalletActionType.SIGN_MESSAGE) {
      const result = await this.transactionsManager.signMessage(
        wallet.getPrivateKey(),
        (action.data as SignMessage).message,
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

    if (action.type === WalletActionType.COVENANT_DEPLOY) {
      const actionData = action.data as CovenantDeployAction;
      const compiled = this.covenantService.parseCompiledContract(
        actionData.compiledContractJson,
      );
      const result = await this.covenantService.deploy(
        compiled,
        actionData.amountSompi,
        wallet.getPrivateKey().toString(),
        action.priorityFee || 0n,
      );
      await notifyUpdate(result.txid);

      const actionResult: CovenantDeployActionResult = {
        type: 'deploy-covenant' as WalletActionResultType,
        performedByWallet: wallet.getAddress(),
        txid: result.txid,
        contractAddress: result.contractAddress,
        outpoint: result.outpoint,
        covenantId: result.covenantId,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type === WalletActionType.COVENANT_SPEND) {
      const actionData = action.data as CovenantSpendAction;
      const compiled = this.covenantService.parseCompiledContract(
        actionData.compiledContractJson,
      );
      const result = await this.covenantService.spend(
        compiled,
        actionData.outpoint,
        actionData.inputAmountSompi,
        actionData.functionName,
        actionData.outputs,
        wallet.getPrivateKey().toString(),
        actionData.extraArgs,
        actionData.covenantId,
        action.priorityFee || 0n,
        actionData.useSenderFee,
        actionData.transactionPayloadHex,
      );
      await notifyUpdate(result.txid);

      const actionResult: CovenantSpendActionResult = {
        type: 'spend-covenant' as WalletActionResultType,
        performedByWallet: wallet.getAddress(),
        txid: result.txid,
        functionName: result.functionName,
        covenantId: result.covenantId,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type === WalletActionType.COVENANT_COMPLETE_PARTIAL) {
      const actionData = action.data as CovenantCompletePartialAction;
      const partialSpend = JSON.parse(actionData.partialSpendJson);
      const result = await this.covenantService.completePartial(
        partialSpend,
        wallet.getPrivateKey().toString(),
      );
      await notifyUpdate(result.txid);

      const actionResult: CovenantCompletePartialActionResult = {
        type: 'complete-covenant-partial' as WalletActionResultType,
        performedByWallet: wallet.getAddress(),
        txid: result.txid,
        functionName: result.functionName,
      };

      return {
        success: true,
        result: actionResult,
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
              newActionsData.options = { ...(newActionsData.options || {}) };
              newActionsData.options.commitTransactionId =
                transactions.commitTransactionId;

              await this.addUnfinishedCommitRevealActionOnLocalStorage({
                createdAtTimestamp: Date.now(),
                operationData: newActionsData,
                walletAddress: wallet.getAddress(),
              });
            }
            notifyUpdate(
              transactions.revealTransactionId ||
                transactions.commitTransactionId!,
            );
          },
          {},
          actionData.options?.additionalOutputs,
          { waitForTransactionToBeConfirmed: !!actionData.options?.revealPskt },
        );

      if (!result.success) {
        console.error('Failed do Commit Reveal action', result);
        return {
          success: false,
          errorCode: result.errorCode,
        };
      }

      await this.removeUnfinishedActionOnLocalStorage(
        {
          operationData: actionData,
          walletAddress: wallet.getAddress(),
          createdAtTimestamp: Date.now(),
        },
        actionData.options?.commitTransactionId || result.result?.commit!,
      );

      let psktTransaction: string | undefined;

      if (actionData.options?.revealPskt) {
        psktTransaction = (
          await this.transactionsManager.createPsktTransactionForRevealOperation(
            wallet,
            actionData.options!.revealPskt!.script,
            result.result?.reveal!,
            actionData.options!.revealPskt!.outputs,
          )
        ).serializeToSafeJSON();
      }

      const actionResult: CommitRevealActionResult = {
        type: WalletActionResultType.CommitReveal,
        commitTransactionId:
          actionData.options?.commitTransactionId || result.result?.commit!,
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
    action: WalletAction,
    wallet?: AppWallet,
  ): Promise<bigint> {
    if (action.type === WalletActionType.EIP1193_PROVIDER_REQUEST) {
      return 0n;
    }

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
        0n,
      );

      return (action.priorityFee || 0n) + totalOutputs + MINIMAL_AMOUNT_TO_SEND;
    }

    if (action.type == WalletActionType.COMMIT_REVEAL) {
      const actionData = action.data;

      const additionalOutputsSum =
        actionData.options?.additionalOutputs?.reduce(
          (acc, curr) => acc + curr.amount,
          0n,
        ) || 0n;

      const additionalPriorityFee = actionData.options?.revealPriorityFee || 0n;

      return (
        (action.priorityFee || 0n) * 2n +
        MINIMAL_TRANSACTION_MASS * 2n +
        SUBMIT_REVEAL_MIN_UTXO_AMOUNT +
        additionalOutputsSum +
        additionalPriorityFee
      );
    }

    if (action.type === WalletActionType.COVENANT_DEPLOY) {
      return (
        action.data.amountSompi +
        (await this.estimateCovenantActionFee(action, wallet))
      );
    }

    if (action.type === WalletActionType.COVENANT_SPEND) {
      const outputsSum = action.data.outputs.reduce(
        (sum, output) => sum + output.amount,
        0n,
      );
      const walletAddedAmount =
        outputsSum > action.data.inputAmountSompi
          ? outputsSum - action.data.inputAmountSompi
          : 0n;
      const senderFeeBuffer = action.data.useSenderFee
        ? MINIMAL_AMOUNT_TO_SEND
        : 0n;
      return (
        walletAddedAmount +
        senderFeeBuffer +
        (await this.estimateCovenantActionFee(action, wallet))
      );
    }

    if (action.type === WalletActionType.COVENANT_COMPLETE_PARTIAL) {
      return await this.estimateCovenantActionFee(action, wallet);
    }

    throw new Error('Invalid action type');
  }

  getWalletAddressFromScriptPublicKey(
    scriptPublicKey: string | IScriptPublicKey | ScriptPublicKey,
  ): string {
    return this.transactionsManager.getWalletAddressFromScriptPublicKey(
      scriptPublicKey,
    );
  }

  async getEstimateFeeRates(): Promise<IFeeEstimate> {
    return await this.transactionsManager.getEstimateFeeRates();
  }

  async estimateCovenantActionFee(
    action: WalletAction,
    wallet?: AppWallet,
  ): Promise<bigint> {
    const privateKeyHex = wallet?.getPrivateKey().toString();

    if (!privateKeyHex) {
      return COVENANT_ESTIMATED_TRANSACTION_MASS * MINIMUM_FEE_PER_MASS;
    }

    if (action.type === WalletActionType.COVENANT_DEPLOY) {
      const actionData = action.data as CovenantDeployAction;
      const compiled = this.covenantService.parseCompiledContract(
        actionData.compiledContractJson,
      );
      return await this.covenantService.estimateDeployFee(
        compiled,
        actionData.amountSompi,
        privateKeyHex,
        action.priorityFee || 0n,
      );
    }

    if (action.type === WalletActionType.COVENANT_SPEND) {
      const actionData = action.data as CovenantSpendAction;
      const compiled = this.covenantService.parseCompiledContract(
        actionData.compiledContractJson,
      );
      return await this.covenantService.estimateSpendFee(
        compiled,
        actionData.outpoint,
        actionData.inputAmountSompi,
        actionData.functionName,
        actionData.outputs,
        privateKeyHex,
        actionData.extraArgs,
        actionData.covenantId,
        action.priorityFee || 0n,
        actionData.useSenderFee,
        actionData.transactionPayloadHex,
      );
    }

    if (action.type === WalletActionType.COVENANT_COMPLETE_PARTIAL) {
      const actionData = action.data as CovenantCompletePartialAction;
      return await this.covenantService.estimateCompletePartialFee(
        JSON.parse(actionData.partialSpendJson),
        privateKeyHex,
      );
    }

    throw new Error('Action is not a covenant action');
  }

  private feeToPriorityFeeComponentMass(fee: bigint): bigint {
    return (fee + MINIMUM_FEE_PER_MASS - 1n) / MINIMUM_FEE_PER_MASS;
  }

  async updateUnfinishedCommitRevealActionOnLocalStorage(
    updateFunction: (
      data: UnfinishedCommitRevealAction[],
    ) => Promise<UnfinishedCommitRevealAction[]>,
  ): Promise<void> {
    const actions = this.getUnfinishedCommitRevealActions();
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_COMMIT_REVEAL_ACTIONS,
      this.utils.stringifyWithBigInt(await updateFunction(actions)),
    );
  }

  async addUnfinishedCommitRevealActionOnLocalStorage(
    action: UnfinishedCommitRevealAction,
  ): Promise<void> {
    await this.updateUnfinishedCommitRevealActionOnLocalStorage(
      async (data) => {
        data.push(action);

        return data;
      },
    );
  }

  async removeUnfinishedActionOnLocalStorage(
    action: UnfinishedCommitRevealAction,
    commitTransactionId: string,
  ): Promise<void> {
    await this.updateUnfinishedCommitRevealActionOnLocalStorage(
      async (data) => {
        const index = data.findIndex(
          (item) =>
            this.utils.stringifyWithBigInt(item.operationData.actionScript) ===
              this.utils.stringifyWithBigInt(
                action.operationData.actionScript,
              ) &&
            action.walletAddress == item.walletAddress &&
            commitTransactionId == item.commitTransactionId,
        );
        if (index !== -1) {
          data.splice(index, 1);
        }

        return data;
      },
    );
  }

  async getWalletUnfinishedActions(
    wallet: AppWallet,
    timeAgo: number = 2 * 60 * 1000,
  ): Promise<UnfinishedCommitRevealAction | undefined> {
    let actions = this.getUnfinishedCommitRevealActions();
    let walletUnfinishedActions = actions.filter(
      (item) =>
        item.walletAddress === wallet.getAddress() &&
        item.createdAtTimestamp < Date.now() - timeAgo,
    );
    let currentUnfinishedAction: UnfinishedCommitRevealAction | undefined =
      undefined;

    while (walletUnfinishedActions.length > 0 && !currentUnfinishedAction) {
      currentUnfinishedAction = walletUnfinishedActions[0];

      const utxoEntry = await this.doesUnfinishedActionHasKasInScriptWallet(
        wallet,
        currentUnfinishedAction.operationData,
      );

      if (utxoEntry) {
        currentUnfinishedAction.commitTransactionId =
          utxoEntry.outpoint.transactionId;
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
        (item) => item.walletAddress === wallet.getAddress(),
      );
    }

    return currentUnfinishedAction;
  }

  getUnfinishedCommitRevealActions(): UnfinishedCommitRevealAction[] {
    const totalActionsJson = localStorage.getItem(
      LOCAL_STORAGE_KEYS.UNFINISHED_COMMIT_REVEAL_ACTIONS,
    );
    const totalActions = this.utils.parseWithBigInt(
      totalActionsJson || '[]',
    ) as UnfinishedCommitRevealAction[];
    return totalActions;
  }

  async doesUnfinishedActionHasKasInScriptWallet(
    wallet: AppWallet,
    action: CommitRevealAction,
  ): Promise<UtxoEntryReference> {
    const script = this.transactionsManager.createGenericScriptFromString(
      action.actionScript.type,
      action.actionScript.stringifyAction,
      wallet.getAddress(),
    );

    let utxos = (
      await this.transactionsManager.getWalletTotalBalanceAndUtxos(
        script.scriptAddress.toString(),
      )
    ).utxoEntries;

    if (action.options?.commitTransactionId) {
      utxos = utxos.filter(
        (utxo) =>
          utxo.outpoint.transactionId == action.options!.commitTransactionId,
      );
    }

    return utxos[0];
  }

  createGenericScriptFromString(
    type: ProtocolType | string,
    stringifyAction: string,
    walletAddress: string,
  ): ProtocolScriptDataAndAddress {
    return this.transactionsManager.createGenericScriptFromString(
      type,
      stringifyAction,
      walletAddress,
    );
  }
}
