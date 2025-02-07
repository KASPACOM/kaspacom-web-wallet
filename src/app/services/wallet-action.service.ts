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
import { ERROR_CODES, WalletActionResult } from 'kaspacom-wallet-messages';
import { UtilsHelper } from './utils.service';
import {
  KaspaNetworkActionsService,
  MINIMAL_AMOUNT_TO_SEND,
} from './kaspa-netwrok-services/kaspa-network-actions.service';
import { ReviewActionComponent } from '../components/wallet-actions-reviews/review-action/review-action.component';
import { WalletActionResultWithError } from '../types/wallet-action-result';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { AppWallet } from '../classes/AppWallet';
import { toObservable } from '@angular/core/rxjs-interop';
import { PsktTransaction } from '../types/kaspa-network/pskt-transaction.interface';
import { Krc20WalletActionService } from './protocols/krc20/krc20-wallet-actions.service';
import { BaseProtocolClassesService } from './protocols/base-protocol-classes.service';

const INSTANT_ACTIONS: { [key: string]: boolean } = {
  [WalletActionType.SIGN_MESSAGE]: true,
};

@Injectable({
  providedIn: 'root',
})
export class WalletActionService {
  private viewingComponent: ReviewActionComponent | undefined = undefined;

  private actionsListByWallet = signal<{
    [walletId: number]: WalletActionListItem[];
  }>({});
  private isActionsRunningByWallet = signal<{
    [walletId: number]: boolean;
  }>({});

  constructor(
    private walletService: WalletService,
    private utils: UtilsHelper,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private krc20WalletActionService: Krc20WalletActionService,
    private baseProtocolClassesService: BaseProtocolClassesService,
  ) {

    this.actionsListByWallet.set({});
    this.isActionsRunningByWallet.set({});

    toObservable(
      this.kaspaNetworkActionsService.getConnectionStatusSignal()
    ).subscribe((status) => {
      const walletsThatHaveWork = this.getWalletIdsThatHaveWork();
      if (status == RpcConnectionStatus.CONNECTED) {
        for (const walletId of walletsThatHaveWork) {
          this.walletService
            .getWalletById(walletId)
            ?.startListiningToWalletActions();
        }
        if (
          this.walletService.getCurrentWallet() &&
          !walletsThatHaveWork.includes(
            this.walletService.getCurrentWallet()!.getId()
          )
        ) {
          this.walletService
            .getCurrentWallet()
            ?.startListiningToWalletActions();
        }
      } else {
        for (const walletId of walletsThatHaveWork) {
          this.walletService
            .getWalletById(walletId)
            ?.stopListiningToWalletActions();
        }
        if (
          this.walletService.getCurrentWallet() &&
          !walletsThatHaveWork.includes(
            this.walletService.getCurrentWallet()!.getId()
          )
        ) {
          this.walletService.getCurrentWallet()?.stopListiningToWalletActions();
        }
      }
    });
  }

  registerViewingComponent(component: ReviewActionComponent): void {
    this.viewingComponent = component;
  }

  createTransferWalletActionFromAsset(
    asset: TransferableAsset,
    targetWalletAddress: string,
    amount: bigint,
    wallet: AppWallet
  ): WalletAction {
    if (asset.type === AssetType.KAS) {
      return {
        type: WalletActionType.TRANSFER_KAS,
        data: {
          amount,
          to: targetWalletAddress,
          sendAll:
            !!(wallet.getWalletUtxoStateBalanceSignal()()?.mature &&
              wallet.getWalletUtxoStateBalanceSignal()()?.mature == amount),
        },
      };
    }

    if (asset.type === AssetType.KRC20) {
      return this.krc20WalletActionService.createTransferWalletAction(asset.ticker, targetWalletAddress, amount);
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
        }
      }
    }

    return {
      type: WalletActionType.COMMIT_REVEAL,
      data: commitRevealActionData,
    };
  }

  createCommitRevealAction(data: CommitRevealAction, priorityFee: bigint): WalletAction {
    return {
      type: WalletActionType.COMMIT_REVEAL,
      data,
      priorityFee
    }
  }

  createSignPsktAction(
    psktDataJson: string,
    submitTransaction: boolean = false
  ): WalletAction {
    return {
      type: WalletActionType.SIGN_PSKT_TRANSACTION,
      data: {
        psktTransactionJson: psktDataJson,
        submitTransaction,
      },
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
    action: WalletAction
  ): Promise<WalletActionResultWithError> {
    const validationResult = await this.validateAction(
      action,
      this.walletService.getCurrentWallet()!
    );
    if (!validationResult.isValidated) {
      return {
        success: false,
        errorCode: validationResult.errorCode,
      };
    }

    const result = await this.showApprovalDialogToUser(action);

    if (!result.isApproved) {
      return {
        success: false,
        errorCode: ERROR_CODES.WALLET_ACTION.USER_REJECTED,
      };
    }

    action.priorityFee = result.priorityFee || action.priorityFee;

    const actionSteps = this.getActionSteps(action);
    let currentStep = 0;

    await this.showTransactionLoaderToUser(0);

    const actionResult = await this.doWalletAction(action, async (data) => {
      currentStep++;

      this.showTransactionLoaderToUser(
        Math.round((currentStep / actionSteps) * 100)
      );

    });

    if (!actionResult.success) {
      alert(actionResult.errorCode);
      return actionResult;
    }

    await this.showTransactionResultToUser(actionResult.result!);

    return actionResult;
  }

  private async showApprovalDialogToUser(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    if (!this.viewingComponent) {
      return {
        isApproved: false,
      };
    }

    return await this.viewingComponent.requestUserConfirmation(action);
  }

  private async showTransactionLoaderToUser(progress?: number | undefined) {
    if (!this.viewingComponent) {
      return;
    }

    this.viewingComponent.showActionLoader(progress);
  }

  private async showTransactionResultToUser(result: WalletActionResult) {
    if (!this.viewingComponent) {
      return;
    }
    this.viewingComponent.showActionLoader(100);
    this.viewingComponent.setActionResult(result);
  }

  private doWalletAction(
    action: WalletAction,
    notifyUpdate: (transactionId: string) => Promise<any>
  ): Promise<WalletActionResultWithError> {
    if (INSTANT_ACTIONS[action.type]) {
      return this.kaspaNetworkActionsService.doWalletAction(
        action,
        this.walletService.getCurrentWallet()!,
        notifyUpdate
      );
    }

    const walletId = this.walletService.getCurrentWallet()!.getId();
    let resolve: (walletActionResult: WalletActionResultWithError) => void;
    let reject: (error: any) => void;

    const promise: Promise<WalletActionResultWithError> =
      new Promise<WalletActionResultWithError>((res, rej) => {
        resolve = res;
        reject = rej;
      });

    const actionsListByWallet = this.actionsListByWallet()![walletId] || [];

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
      [walletId]: actionsListByWallet,
    });

    this.startProcessingActionsOnActionListIfNotRunning(walletId);

    return promise;
  }

  private async startProcessingActionsOnActionListIfNotRunning(
    walletId: number
  ) {
    if (this.isActionsRunningByWallet()[walletId]) {
      return;
    }

    const wallet = this.walletService.getWalletById(walletId);

    this.isActionsRunningByWallet.set({
      ...this.isActionsRunningByWallet(),
      [walletId]: true,
    });
    wallet?.setIsCurrentlyActive(true);

    try {
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      while (
        this.actionsListByWallet()[walletId] &&
        this.actionsListByWallet()[walletId].length > 0
      ) {
        const actionsList = this.actionsListByWallet()[walletId];
        const action = actionsList!.shift()!;

        this.actionsListByWallet.set({
          ...this.actionsListByWallet(),
          [walletId]: actionsList,
        });

        try {
          await this.kaspaNetworkActionsService.connectAndDo(async () => {
            await wallet.waitForUtxoProcessorToBeReady();

            const validationResult = await this.validateAction(
              action.action,
              wallet
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
                  action.notifyUpdate
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
        [walletId]: false,
      });
      wallet?.setIsCurrentlyActive(false);

      if (this.walletService.getCurrentWallet()?.getId() != walletId) {
        wallet?.stopListiningToWalletActions();
      }
    }
  }

  async validateAction(
    action: WalletAction,
    wallet: AppWallet,
    checkAlsoProtocolData: boolean = false
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

    const isRevealOnly = action.type == WalletActionType.COMMIT_REVEAL && (action.data as CommitRevealAction).options?.commitTransactionId;

    if (isRevealOnly) {
      const actionData = action.data as CommitRevealAction;
      // Retreive kas only, no need for validation
      if (!(actionData.options?.additionalOutputs || actionData.options?.revealPriorityFee || checkAlsoProtocolData)) {
        return {
          isValidated: true,
        }
      }
    }

    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
        validationResult = await this.validateTransferKasAction(
          action.data as TransferKasAction,
          wallet
        );
        break;
      case WalletActionType.COMPOUND_UTXOS:
        validationResult = await this.validateCompoundUtxosAction(wallet);
        break;

      case WalletActionType.SIGN_PSKT_TRANSACTION:
        validationResult = await this.validateSignPsktTransactionAction(
          action.data as SignPsktTransactionAction,
          wallet
        );
        break;

      case WalletActionType.COMMIT_REVEAL: {
        validationResult = await this.validateCommitRevealAction(action.data as CommitRevealAction, wallet);
        break;
      }

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
        wallet?.getWalletUtxoStateBalanceSignal()()?.mature || 0n;

      const requiredKaspaAmount =
        await this.kaspaNetworkActionsService.getMinimalRequiredAmountForAction(
          action
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
    wallet: AppWallet
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    await wallet.getUtxoProcessorManager()?.waitForPendingUtxoToFinish();

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
    wallet: AppWallet
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
      wallet.getWalletUtxoStateBalanceSignal()()?.mature || 0n;
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
    wallet: AppWallet
  ): Promise<{ isValidated: boolean; errorCode?: number }> {

    if (!action.actionScript || !action.actionScript.scriptDataStringify || !action.actionScript.scriptProtocol) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_COMMIT_REVEAL_DATA,
      }
    }

    try {

      const validator = this.baseProtocolClassesService.getClassesFor(action.actionScript.scriptProtocol)?.validator;

      if (validator) {
        return await validator.validateCommitRevealAction(action, wallet);
      }

    } catch (err) {
      console.error(err)
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
    wallet: AppWallet
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
      const transactionInputWalletUtxos = await this.kaspaNetworkActionsService.getWalletBalanceAndUtxos(input.utxo.address);

      const transactionInputUtxo = transactionInputWalletUtxos.utxoEntries.find((utxo) =>
        utxo.outpoint.transactionId == input.transactionId
      );

      if (!transactionInputUtxo) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
        }
      }
    }

    return {
      isValidated: true,
    };
  }

  private getActionSteps(action: WalletAction): number {
    if (action.type == WalletActionType.COMMIT_REVEAL && !action.data?.options?.commitTransactionId) {
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
    [walletId: number]: boolean;
  }> {
    return this.isActionsRunningByWallet.asReadonly();
  }

  getWalletIdsThatHaveWork(): number[] {
    const busyWallets = [];

    for (let walletId in this.isActionsRunningByWallet()) {
      if (this.isActionsRunningByWallet()[+walletId]) {
        busyWallets.push(+walletId);
      }
    }

    for (let walletId in this.actionsListByWallet()) {
      if (this.actionsListByWallet()[+walletId].length > 0) {
        busyWallets.push(+walletId);
      }
    }

    return Array.from(new Set(busyWallets));
  }
}
