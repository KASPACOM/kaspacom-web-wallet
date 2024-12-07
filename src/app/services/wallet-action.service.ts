import { Injectable, Signal, signal } from '@angular/core';
import {
  Krc20Action,
  TransferKasAction,
  WalletAction,
  WalletActionListItem,
  WalletActionType,
} from '../types/wallet-action';
import { AssetType, TransferableAsset } from '../types/transferable-asset';
import { WalletService } from './wallet.service';
import { ERROR_CODES } from '../config/consts';
import { UtilsHelper } from './utils.service';
import {
  KaspaNetworkActionsService,
  MINIMAL_AMOUNT_TO_SEND,
} from './kaspa-netwrok-services/kaspa-network-actions.service';
import { ReviewActionComponent } from '../components/review-action/review-action.component';
import {
  WalletActionResult,
  WalletActionResultWithError,
} from '../types/wallet-action-result';
import { Krc20OperationDataService } from './kaspa-netwrok-services/krc20-operation-data.service';
import { KRC20OperationType } from '../types/kaspa-network/krc20-operations-data.interface';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';
import { TokenState } from './kasplex-api/dtos/token-list-info.dto';

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
    private krc20OperationDataService: Krc20OperationDataService,
    private kasplexService: KasplexKrc20Service
  ) {}

  registerViewingComponent(component: ReviewActionComponent): void {
    this.viewingComponent = component;
  }

  createTransferWalletActionFromAsset(
    asset: TransferableAsset,
    targetWalletAddress: string,
    amount: bigint
  ): WalletAction {
    if (asset.type === AssetType.KAS) {
      return {
        type: WalletActionType.TRANSFER_KAS,
        data: {
          amount,
          to: targetWalletAddress,
        },
      };
    }

    if (asset.type === AssetType.KRC20) {
      return {
        type: WalletActionType.KRC20_ACTION,
        data: {
          operationData: this.krc20OperationDataService.getTransferData(
            asset.ticker,
            amount,
            targetWalletAddress
          ),
        },
      };
    }

    throw new Error('Unsupported asset type');
  }

  createMintWalletAction(ticker: string): WalletAction {
    return {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData: this.krc20OperationDataService.getMintData(ticker),
      },
    };
  }

  async validateAndDoActionAfterApproval(
    action: WalletAction
  ): Promise<{ success: boolean; errorCode?: number; result?: any }> {
    const validationResult = await this.validateAction(action);
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
      console.log('notify update', data);
      this.showTransactionLoaderToUser(
        Math.round((currentStep / actionSteps) * 100)
      );

      currentStep++;
    });

    console.log('FINISHED ACTION', actionResult);

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
    const walletId = this.walletService.getCurrentWallet()!.getId();
    let resolve: ((walletActionResult: WalletActionResultWithError) => void);
    let reject: ((error: any) => void);

    const promise: Promise<WalletActionResultWithError> =
      new Promise<WalletActionResultWithError>((res, rej) => {
        resolve = res;
        reject = rej;
      });

    const actionsListByWallet =
      this.actionsListByWallet()![walletId] || [];

    actionsListByWallet.push({
      action,
      promise,
      reject: reject!,
      resolve: resolve!,
      wallet: this.walletService.getCurrentWallet()!,
      notifyUpdate,
    });

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

    this.isActionsRunningByWallet.set({
      ...this.isActionsRunningByWallet(),
      [walletId]: true,
    });

    try {
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
          const result = await this.kaspaNetworkActionsService.doWalletAction(
            action.action,
            action.wallet,
            action.notifyUpdate
          );

          action.resolve(result);
        } catch (error) {
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
    }
  }

  private async validateAction(
    action: WalletAction
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (!this.walletService.getCurrentWallet()) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.WALLET_NOT_SELECTED,
      };
    }

    let validationResult: { isValidated: boolean; errorCode?: number } = {
      isValidated: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };

    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
        validationResult = await this.validateTransferKasAction(
          action.data as TransferKasAction
        );
        break;
      case WalletActionType.KRC20_ACTION:
        validationResult = await this.validateKrc20Action(
          action.data as Krc20Action
        );
        break;
    }

    if (
      !(
        action.type == WalletActionType.TRANSFER_KAS &&
        (action.data as TransferKasAction).sendAll
      )
    ) {
      const currentBalance =
        this.walletService
          .getCurrentWallet()
          ?.getWalletUtxoStateBalanceSignal()()?.mature || 0n;

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

  async validateTransferKasAction(
    action: TransferKasAction
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
      this.walletService.getCurrentWallet()?.getWalletUtxoStateBalanceSignal()()
        ?.mature || 0n;
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

  async validateKrc20Action(
    action: Krc20Action
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (action.operationData.op == KRC20OperationType.TRANSFER) {
      if (this.utils.isNullOrEmptyString(action.operationData.to!)) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
        };
      }

      if (!this.utils.isValidWalletAddress(action.operationData.to!)) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
        };
      }

      const currentBalance = await firstValueFrom(
        this.kasplexService.getTokenWalletBalanceInfo(
          this.walletService.getCurrentWallet()!.getAddress(),
          action.operationData.tick
        )
      );

      if (!currentBalance) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
        };
      }

      if (
        BigInt(currentBalance.balance) < BigInt(action.operationData.amt || '0')
      ) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
        };
      }

      return { isValidated: false };
    }

    if (action.operationData.op == KRC20OperationType.MINT) {
      const tokenData = await firstValueFrom(
        this.kasplexService.getTokenInfo(action.operationData.tick)
      );

      if (!tokenData.result?.[0]) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND,
        };
      }

      if (tokenData.result[0].state != TokenState.DEPLOYED) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.TOKEN_NOT_IN_MINTABLE_STATE,
        };
      }

      return {
        isValidated: true,
      };
    }

    return {
      isValidated: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };
  }

  private getActionSteps(action: WalletAction): number {
    if (action.type == WalletActionType.KRC20_ACTION) {
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
}
