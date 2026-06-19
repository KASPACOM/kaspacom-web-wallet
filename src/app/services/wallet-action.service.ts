import { Injectable, Signal, signal } from '@angular/core';
import {
  SignPsktTransactionAction,
  CommitRevealAction,
  SignMessage,
  TransferKasAction,
  WalletAction,
  WalletActionListItem,
  WalletActionType,
} from '../types/wallet-action';
import { AssetType, TransferableAsset } from '../types/transferable-asset';
import { WalletService } from './wallet.service';
import {
  EIP1193RequestPayload,
  EIP1193RequestType,
  ERROR_CODES,
  ERROR_CODES_MESSAGES,
  EthTransactionParams,
  ProtocolType,
  PsktActionsEnum,
  WalletActionResult,
} from '@kaspacom/wallet-messages';
import { UtilsHelper } from './utils.service';
import {
  KaspaNetworkActionsService,
  MINIMAL_AMOUNT_TO_SEND,
} from './kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionResultWithError } from '../types/wallet-action-result';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { AppWallet } from '../classes/AppWallet';
import { toObservable } from '@angular/core/rxjs-interop';
import { PsktTransaction } from '../types/kaspa-network/pskt-transaction.interface';
import { Krc20WalletActionService } from './protocols/krc20/krc20-wallet-actions.service';
import { BaseProtocolClassesService } from './protocols/base-protocol-classes.service';
import { Router } from '@angular/router';
import { EthereumHandleActionRequestService } from './etherium-services/etherium-handle-action-request.service';
import { BaseCommunicationApp } from './communication-service/communication-app/base-communication-app';
import {
  ApprovalFlowService,
  ApprovalPageResultParams,
} from '../v2/services/approval-flow.service';
import { MonitorService } from './monitor.service';

const INSTANT_ACTIONS: { [key: string]: boolean } = {
  [WalletActionType.SIGN_MESSAGE]: true,
  [WalletActionType.EIP1193_PROVIDER_REQUEST]: true,
};

@Injectable({
  providedIn: 'root',
})
export class WalletActionService {
  private actionsListByWallet = signal<{
    [walletIdWithAccount: string]: WalletActionListItem[];
  }>({});
  private isActionsRunningByWallet = signal<{
    [walletIdWithAccount: string]: boolean;
  }>({});
  private actionToApprove = signal<
    | {
        action: WalletAction;
        resolve: (data: { isApproved: boolean; priorityFee?: bigint }) => void;
        additionalParams?: { [parmName: string]: any };
      }
    | undefined
  >(undefined);

  private currentProgressSignal = signal<number | undefined>(undefined);
  private actionResultSignal = signal<WalletActionResult | undefined>(
    undefined,
  );

  constructor(
    private walletService: WalletService,
    private utils: UtilsHelper,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private krc20WalletActionService: Krc20WalletActionService,
    private baseProtocolClassesService: BaseProtocolClassesService,
    private readonly router: Router,
    private readonly ethereumHandleActionRequestService: EthereumHandleActionRequestService,
    private readonly approvalFlowService: ApprovalFlowService,
    private readonly monitorService: MonitorService,
  ) {
    this.actionsListByWallet.set({});
    this.isActionsRunningByWallet.set({});

    toObservable(
      this.kaspaNetworkActionsService.getConnectionStatusSignal(),
    ).subscribe((status) => {
      const walletsThatHaveWork = this.getWalletIdsWithAccountsThatHaveWork();
      if (status == RpcConnectionStatus.CONNECTED) {
        for (const walletIdAndAccount of walletsThatHaveWork) {
          this.walletService
            .getWalletByIdAndAccount(walletIdAndAccount)
            ?.startListiningToWalletActions();
        }
        if (
          this.walletService.getCurrentWallet() &&
          !walletsThatHaveWork.includes(
            this.walletService.getCurrentWallet()!.getIdWithAccount(),
          )
        ) {
          this.walletService
            .getCurrentWallet()
            ?.startListiningToWalletActions();
        }
      } else {
        for (const walletIdAndAccount of walletsThatHaveWork) {
          this.walletService
            .getWalletByIdAndAccount(walletIdAndAccount)
            ?.stopListiningToWalletActions();
        }
        if (
          this.walletService.getCurrentWallet() &&
          !walletsThatHaveWork.includes(
            this.walletService.getCurrentWallet()!.getIdWithAccount(),
          )
        ) {
          this.walletService.getCurrentWallet()?.stopListiningToWalletActions();
        }
      }
    });
  }

  createTransferKasWalletAction(
    targetWalletAddress: string,
    amount: bigint,
    wallet: AppWallet,
    rbf: boolean = false,
  ): WalletAction {
    return {
      type: WalletActionType.TRANSFER_KAS,
      rbf,
      data: {
        amount,
        to: targetWalletAddress,
        sendAll: !!(
          wallet.getCurrentWalletStateBalanceSignalValue()?.mature &&
          wallet.getCurrentWalletStateBalanceSignalValue()?.mature == amount
        ),
      },
    };
  }

  createTransferWalletActionFromAsset(
    asset: TransferableAsset,
    targetWalletAddress: string,
    amount: bigint,
    wallet: AppWallet,
    rbf: boolean = false,
  ): WalletAction {
    if (asset.type === AssetType.KAS) {
      return this.createTransferKasWalletAction(
        targetWalletAddress,
        amount,
        wallet,
        rbf,
      );
    }

    if (asset.type === AssetType.KRC20) {
      return this.krc20WalletActionService.createTransferWalletAction(
        asset.ticker,
        targetWalletAddress,
        amount,
      );
    }

    throw new Error('Unsupported asset type');
  }

  createCompoundUtxosAction(): WalletAction {
    return {
      type: WalletActionType.COMPOUND_UTXOS,
      data: {},
    };
  }

  createUnfinishedCommitRevealAction(
    commitRevealActionData: CommitRevealAction,
    shouldFinish: boolean = false,
  ): WalletAction {
    if (!shouldFinish) {
      commitRevealActionData = {
        ...commitRevealActionData,
        options: {
          ...(commitRevealActionData.options || 0),
          additionalOutputs: undefined,
          revealPriorityFee: undefined,
        },
      };
    }

    return {
      type: WalletActionType.COMMIT_REVEAL,
      data: commitRevealActionData,
    };
  }

  createCommitRevealAction(
    data: CommitRevealAction,
    priorityFee?: bigint,
  ): WalletAction {
    return {
      type: WalletActionType.COMMIT_REVEAL,
      data,
      priorityFee,
    };
  }

  createSignPsktAction(
    psktDataJson: string,
    submitTransaction: boolean = false,
    protocol?: ProtocolType | string,
    type?: PsktActionsEnum | string,
    signOnly?: boolean
  ): WalletAction {
    return {
      type: WalletActionType.SIGN_PSKT_TRANSACTION,
      data: {
        psktTransactionJson: psktDataJson,
        signOnly,
        submitTransaction,
        protocol,
        type,
      },
    };
  }

  createEIP1193Action(
    request: EIP1193RequestPayload<EIP1193RequestType>,
  ): WalletAction {
    return {
      type: WalletActionType.EIP1193_PROVIDER_REQUEST,
      data: request,
    };
  }

  createSignMessageAction(message: string): WalletAction {
    return {
      type: WalletActionType.SIGN_MESSAGE,
      data: {
        message,
      },
    };
  }

  async validateAndDoActionAfterApproval(
    action: WalletAction,
    isFromIframe: boolean = false,
    onActionApproval: undefined | (() => Promise<void>) = undefined,
  ): Promise<WalletActionResultWithError & { isUsingV2Flow?: boolean }> {
    const validationResult = await this.validateAction(
      action,
      this.walletService.getCurrentWallet()!,
    );
    if (!validationResult.isValidated) {
      return {
        success: false,
        errorCode: validationResult.errorCode,
      };
    }

    const isUsingV2Flow = !isFromIframe && this.isV2AppContext();
    const result = await this.showApprovalDialogToUser(action, isFromIframe);

    if (!result.isApproved) {
      return {
        success: false,
        errorCode: ERROR_CODES.EIP1193.USER_REJECTED,
      };
    }

    // If using v2 flow, immediately transition to processing state
    if (isUsingV2Flow) {
      this.approvalFlowService.setProcessingState(0);
    }

    await onActionApproval?.();

    action.priorityFee = result.priorityFee || action.priorityFee;

    if (
      result.l2PriorityInfo &&
      action.type === WalletActionType.EIP1193_PROVIDER_REQUEST
    ) {
      const actionTransaction = {
        ...(action.data.params[0] as EthTransactionParams),
      };

      if (result.l2PriorityInfo.gasLimit) {
        actionTransaction.gasLimit = String(result.l2PriorityInfo.gasLimit);
      }

      if (
        result.l2PriorityInfo.priorityFee !== undefined &&
        result.l2PriorityInfo.baseFee !== undefined
      ) {
        actionTransaction.maxPriorityFeePerGas = String(
          result.l2PriorityInfo.priorityFee,
        );
        actionTransaction.maxFeePerGas = String(
          result.l2PriorityInfo.baseFee + result.l2PriorityInfo.priorityFee,
        );
      }

      action.data.params[0] = actionTransaction;
    }

    // // Add 2-second delay to allow canvas animation to show before processing
    // if (isUsingV2Flow) {
    //   await new Promise(resolve => setTimeout(resolve, 2000));
    // }

    const actionSteps = this.getActionSteps(action);
    let currentStep = 0;
    const currentWalletAddress = this.walletService
      .getCurrentWallet()!
      .getAddress();

    // Show loading state for legacy/iframe flow before executing
    if (!isUsingV2Flow) {
      await this.showTransactionLoaderToUser(0, currentWalletAddress);
    }
    const isTransaction = this.isTransactionAction(action);
    if (isTransaction) {
      this.monitorService.track('Transaction Started', {
        action_type: action.type,
      });
    }

    let actionResult: WalletActionResultWithError;
    try {
      actionResult = await this.doWalletAction(action, async (data) => {
        currentStep++;
        const progress = Math.round((currentStep / actionSteps) * 100);

        if (isUsingV2Flow) {
          // Update the new approval flow with progress
          this.approvalFlowService.updateProgress(progress);
        } else {
          // Use legacy progress display
          this.showTransactionLoaderToUser(progress, currentWalletAddress);
        }
      });
    } catch (error) {
      console.error('Error executing wallet action:', error);

      if (isTransaction) {
        this.monitorService.track('Transaction Failed', {
          action_type: action.type,
          error_category: 'unknown',
          error_code: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
          error_name: error instanceof Error ? error.name : 'UnknownError',
        });
      }

      if (isUsingV2Flow) {
        const fallbackMessage =
          'Transaction failed due to an unexpected error.';
        const errorMessage =
          error instanceof Error && error.message
            ? error.message
            : (ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR] ??
              fallbackMessage);
        this.approvalFlowService.setErrorState(errorMessage);
      } else {
        this.clearActionResult();
      }

      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
      };
    }

    if (!actionResult.success) {
      if (isTransaction) {
        this.monitorService.track('Transaction Failed', {
          action_type: action.type,
          error_code: actionResult.errorCode,
          error_category: 'wallet_action',
        });
      }

      if (isUsingV2Flow) {
        const errorMessage = actionResult.errorCode
          ? ERROR_CODES_MESSAGES[actionResult.errorCode]
          : 'Transaction failed';
        this.approvalFlowService.setErrorState(errorMessage);
      } else {
        this.clearActionResult();
      }
      return { ...actionResult, isUsingV2Flow };
    }

    if (isUsingV2Flow) {
      // Show success page in the new approval flow
      this.approvalFlowService.setSuccessState(actionResult.result!);
    } else {
      // Use legacy success display
      await this.showTransactionResultToUser(
        actionResult.result!,
        currentWalletAddress,
      );
    }

    if (isTransaction) {
      this.monitorService.track('Transaction Succeeded', {
        action_type: action.type,
      });
    }

    return { ...actionResult, isUsingV2Flow };
  }

  async showCommunicationAppApprovalDialogToUser(
    app: BaseCommunicationApp,
    isFromIframe: boolean = false,
  ): Promise<{
    isApproved: boolean;
    alwaysApprove: boolean;
  }> {
    const result = await this.showApprovalDialogToUser(
      {
        type: WalletActionType.APPROVE_COMMUNICATION_APP,
        data: app,
      },
      isFromIframe,
    );

    return {
      alwaysApprove: !!result.additionalParams?.['alwaysApprove'],
      isApproved: result.isApproved,
    };
  }

  private async showApprovalDialogToUser(
    action: WalletAction,
    isFromIframe: boolean = false,
  ): Promise<ApprovalPageResultParams> {
    // Use the new approval flow service for modern flow-based approvals
    if (!isFromIframe && this.isV2AppContext()) {
      return await this.approvalFlowService.showApproval(action, isFromIframe);
    }

    // Legacy approval system for iframe and legacy contexts
    if (this.actionToApprove()) {
      this.actionToApprove()!.resolve({ isApproved: false });
      this.actionToApprove.set(undefined);
    }

    const promise = new Promise<{
      isApproved: boolean;
      priorityFee?: bigint;
      additionalParams?: { [parmName: string]: any };
    }>((res) => {
      this.actionResultSignal.set(undefined);
      this.actionToApprove.set({
        action,
        resolve: res,
      });
      this.currentProgressSignal.set(undefined);
    });

    return await promise.then((data) => {
      this.actionToApprove.set(undefined);

      return data;
    });
  }

  private isV2AppContext(): boolean {
    // Check if we're in the v2 app context (not in legacy routes)
    return (
      !this.router.url.startsWith('/legacy') &&
      this.router.url.startsWith('/app')
    );
  }

  getActionToApproveSignal(): Signal<
    | {
        action: WalletAction;
        resolve: (data: {
          isApproved: boolean;
          priorityFee?: bigint;
          additionalParams?: { [parmName: string]: any };
        }) => void;
      }
    | undefined
  > {
    return this.actionToApprove.asReadonly();
  }

  getCurrentProgressSignal(): Signal<number | undefined> {
    return this.currentProgressSignal.asReadonly();
  }

  getActionResultSignal(): Signal<WalletActionResult | undefined> {
    return this.actionResultSignal.asReadonly();
  }

  clearActionResult(): void {
    this.actionResultSignal.set(undefined);
    this.currentProgressSignal.set(undefined);
  }

  private async showTransactionLoaderToUser(
    progress?: number | undefined,
    walletAddress?: string,
  ) {
    if (walletAddress != this.walletService.getCurrentWallet()?.getAddress()) {
      return;
    }

    this.currentProgressSignal.set(progress);
  }

  private async showTransactionResultToUser(
    result: WalletActionResult,
    walletAddress: string,
  ) {
    if (walletAddress != this.walletService.getCurrentWallet()?.getAddress()) {
      return;
    }

    this.currentProgressSignal.set(100);
    this.actionResultSignal.set(result);
  }

  private doWalletAction(
    action: WalletAction,
    notifyUpdate: (transactionId: string) => Promise<any>,
  ): Promise<WalletActionResultWithError> {
    if (INSTANT_ACTIONS[action.type]) {
      if (
        action.type === WalletActionType.EIP1193_PROVIDER_REQUEST &&
        !this.ethereumHandleActionRequestService.isKasAction(action.data.method)
      ) {
        return this.ethereumHandleActionRequestService.doEIP1193ProviderRequest(
          action.data as EIP1193RequestPayload<EIP1193RequestType>,
          this.walletService.getCurrentWallet()!,
        );
      } else {
        return this.kaspaNetworkActionsService.doWalletAction(
          action,
          this.walletService.getCurrentWallet()!,
          notifyUpdate,
        );
      }
    }

    const walletIdWithAccount = this.walletService
      .getCurrentWallet()!
      .getIdWithAccount();
    let resolve: (walletActionResult: WalletActionResultWithError) => void;
    let reject: (error: any) => void;

    const promise: Promise<WalletActionResultWithError> =
      new Promise<WalletActionResultWithError>((res, rej) => {
        resolve = res;
        reject = rej;
      });

    const actionsListByWallet =
      this.actionsListByWallet()![walletIdWithAccount] || [];

    actionsListByWallet.push({
      action,
      promise,
      reject: reject!,
      resolve: resolve!,
      notifyUpdate,
    });

    const globalScope: any = window as any;

    if (globalScope.repeatAction) {
      for (let i = 1; i < globalScope.repeatAction; i++) {
        actionsListByWallet.push({
          action,
          promise,
          reject: reject!,
          resolve: resolve!,
          notifyUpdate,
        });
      }

      globalScope.repeatAction = undefined;
    }

    this.actionsListByWallet.set({
      ...this.actionsListByWallet(),
      [walletIdWithAccount]: actionsListByWallet,
    });

    this.startProcessingActionsOnActionListIfNotRunning(walletIdWithAccount);

    return promise;
  }

  private async startProcessingActionsOnActionListIfNotRunning(
    walletIdWithAccount: string,
  ) {
    if (this.isActionsRunningByWallet()[walletIdWithAccount]) {
      return;
    }

    const wallet =
      this.walletService.getWalletByIdAndAccount(walletIdWithAccount);

    this.isActionsRunningByWallet.set({
      ...this.isActionsRunningByWallet(),
      [walletIdWithAccount]: true,
    });
    wallet?.setIsCurrentlyActive(true);

    try {
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      while (
        this.actionsListByWallet()[walletIdWithAccount] &&
        this.actionsListByWallet()[walletIdWithAccount].length > 0
      ) {
        const actionsList = this.actionsListByWallet()[walletIdWithAccount];

        if (actionsList[0] && !actionsList[0].action.rbf) {
          await wallet.waitForWalletToBeReadyForTransactions();
        }

        const action = actionsList!.shift()!;

        this.actionsListByWallet.set({
          ...this.actionsListByWallet(),
          [walletIdWithAccount]: actionsList,
        });

        try {
          await this.showTransactionLoaderToUser(0);

          await this.kaspaNetworkActionsService.connectAndDo(async () => {
            const validationResult = await this.validateAction(
              action.action,
              wallet,
            );

            if (!validationResult.isValidated) {
              action.resolve({
                success: false,
                errorCode: validationResult.errorCode,
              });
            } else {
              const result =
                await this.kaspaNetworkActionsService.doWalletAction(
                  action.action,
                  wallet,
                  action.notifyUpdate,
                );

              action.resolve(result);
            }
          });
        } catch (error) {
          console.error(error);
          action.reject(error);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.isActionsRunningByWallet.set({
        ...this.isActionsRunningByWallet(),
        [walletIdWithAccount]: false,
      });
      wallet?.setIsCurrentlyActive(false);

      if (
        this.walletService.getCurrentWallet()?.getIdWithAccount() !=
        walletIdWithAccount
      ) {
        wallet?.stopListiningToWalletActions();
      }
    }
  }

  async validateAction(
    action: WalletAction,
    wallet: AppWallet,
    checkAlsoProtocolData: boolean = false,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (!wallet) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.WALLET_NOT_SELECTED,
      };
    }

    let validationResult: { isValidated: boolean; errorCode?: number } = {
      isValidated: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };

    const isRevealOnly =
      action.type == WalletActionType.COMMIT_REVEAL &&
      (action.data as CommitRevealAction).options?.commitTransactionId;

    if (isRevealOnly) {
      const actionData = action.data as CommitRevealAction;
      // Retreive kas only, no need for validation
      if (
        !(
          actionData.options?.additionalOutputs ||
          actionData.options?.revealPriorityFee ||
          checkAlsoProtocolData
        )
      ) {
        return {
          isValidated: true,
        };
      }
    }

    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
        validationResult = await this.validateTransferKasAction(
          action.data as TransferKasAction,
          wallet,
        );
        break;
      case WalletActionType.COMPOUND_UTXOS:
        validationResult = await this.validateCompoundUtxosAction(wallet);
        break;

      case WalletActionType.SIGN_PSKT_TRANSACTION:
        validationResult = await this.validateSignPsktTransactionAction(
          action.data as SignPsktTransactionAction,
          wallet,
        );
        break;
      case WalletActionType.EIP1193_PROVIDER_REQUEST:
        validationResult =
          await this.ethereumHandleActionRequestService.validateEIP1193ProviderRequestAction(
            action.data as EIP1193RequestPayload<EIP1193RequestType>,
            wallet,
          );
        break;

      case WalletActionType.COMMIT_REVEAL:
        validationResult = await this.validateCommitRevealAction(
          action.data as CommitRevealAction,
          wallet,
        );
        break;

      case WalletActionType.SIGN_MESSAGE:
        if (
          this.utils.isNullOrEmptyString((action.data as SignMessage).message)
        ) {
          validationResult = {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_MESSAGE_TO_SIGN,
          };
        } else {
          validationResult = {
            isValidated: true,
          };
        }

        break;
    }

    if (
      !(
        action.type == WalletActionType.TRANSFER_KAS &&
        (action.data as TransferKasAction).sendAll
      ) &&
      action.type != WalletActionType.SIGN_MESSAGE &&
      !isRevealOnly
    ) {
      const currentBalance =
        wallet?.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;

      const requiredKaspaAmount =
        await this.kaspaNetworkActionsService.getMinimalRequiredAmountForAction(
          action,
        );

      if (currentBalance < requiredKaspaAmount) {
        validationResult = {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
        };
      }
    }

    return validationResult;
  }

  private async validateCompoundUtxosAction(
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if ((wallet.getBalanceSignal()()?.utxoEntries.length || 0) < 2) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.NO_UTXOS_TO_COMPOUND,
      };
    }

    return {
      isValidated: true,
    };
  }

  private async validateTransferKasAction(
    action: TransferKasAction,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (action.amount <= MINIMAL_AMOUNT_TO_SEND) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
      };
    }

    if (this.utils.isNullOrEmptyString(action.to)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
      };
    }

    if (!this.utils.isValidWalletAddress(action.to)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
      };
    }

    const currentBalance =
      wallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;
    if (currentBalance < action.amount) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
      };
    }

    return {
      isValidated: true,
    };
  }

  private async validateCommitRevealAction(
    action: CommitRevealAction,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (
      !action.actionScript ||
      !action.actionScript.stringifyAction ||
      !action.actionScript.type
    ) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_COMMIT_REVEAL_DATA,
      };
    }

    try {
      const validator = this.baseProtocolClassesService.getClassesFor(
        action.actionScript.type,
      )?.validator;

      if (validator) {
        return await validator.validateCommitRevealAction(action, wallet);
      }
    } catch (err) {
      console.error(err);
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_COMMIT_REVEAL_DATA,
      };
    }

    return {
      isValidated: true,
    };
  }

  private async validateSignPsktTransactionAction(
    action: SignPsktTransactionAction,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (this.utils.isNullOrEmptyString(action.psktTransactionJson)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
      };
    }

    let transaction: PsktTransaction;

    try {
      transaction = JSON.parse(action.psktTransactionJson);
    } catch (error) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
      };
    }

    for (const input of transaction.inputs) {
      const utxoAddress =
        input.utxo.address ||
        this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(
          input.utxo.scriptPublicKey,
        );

      if (!utxoAddress) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
        };
      }

      const transactionInputWalletUtxos =
        await this.kaspaNetworkActionsService.getWalletBalanceAndUtxos(
          utxoAddress,
        );

      const transactionInputUtxo = transactionInputWalletUtxos.utxoEntries.find(
        (utxo) => utxo.outpoint.transactionId == input.transactionId,
      );

      if (!transactionInputUtxo) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
        };
      }
    }

    return {
      isValidated: true,
    };
  }

  /**
   * Whether an action produces an on-chain transaction, so the `Transaction *`
   * analytics events stay scoped to true transaction outcomes. Non-transaction
   * actions (sign message, app approval, non-send EIP-1193 methods like
   * add/switch chain) are excluded to avoid polluting transaction metrics.
   */
  private isTransactionAction(action: WalletAction): boolean {
    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
      case WalletActionType.COMPOUND_UTXOS:
      case WalletActionType.SIGN_PSKT_TRANSACTION:
      case WalletActionType.COMMIT_REVEAL:
        return true;
      case WalletActionType.EIP1193_PROVIDER_REQUEST:
        return (
          action.data.method === EIP1193RequestType.SEND_TRANSACTION ||
          action.data.method === EIP1193RequestType.KAS_SEND_TRANSACTION
        );
      default:
        return false;
    }
  }

  private getActionSteps(action: WalletAction): number {
    if (
      action.type == WalletActionType.COMMIT_REVEAL &&
      !action.data?.options?.commitTransactionId
    ) {
      return 3;
    }

    return 2;
  }

  getWalletsWaitingActionList(): Signal<{
    [walletId: number]: WalletActionListItem[];
  }> {
    return this.actionsListByWallet.asReadonly();
  }

  getActiveWalletActionProcessors(): Signal<{
    [walletIdAndAccount: string]: boolean;
  }> {
    return this.isActionsRunningByWallet.asReadonly();
  }

  getWalletIdsWithAccountsThatHaveWork(): string[] {
    const busyWallets = [];

    for (let walletIdWithAccount in this.isActionsRunningByWallet()) {
      if (this.isActionsRunningByWallet()[walletIdWithAccount]) {
        busyWallets.push(walletIdWithAccount);
      }
    }

    for (let walletIdWithAccount in this.actionsListByWallet()) {
      if (this.actionsListByWallet()[walletIdWithAccount].length > 0) {
        busyWallets.push(walletIdWithAccount);
      }
    }

    return Array.from(new Set(busyWallets));
  }

  resolveCurrentWaitingForApproveAction(
    isApproved: boolean,
    priorityFee?: bigint,
    additionalParams?: { [parmName: string]: any },
  ) {
    if (
      this.getActionToApproveSignal()?.() &&
      this.getActionToApproveSignal()?.()?.resolve
    ) {
      this.getActionToApproveSignal()()!.resolve({
        isApproved,
        priorityFee,
        additionalParams,
      });
    }
  }
}
