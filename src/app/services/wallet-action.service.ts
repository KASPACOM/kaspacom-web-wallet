import { Injectable } from '@angular/core';
import {
  Krc20Action,
  TransferKasAction,
  WalletAction,
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

@Injectable({
  providedIn: 'root',
})
export class WalletActionService {
  private viewingComponent: ReviewActionComponent | undefined = undefined;

  constructor(
    private walletService: WalletService,
    private utils: UtilsHelper,
    private kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {}

  registerViewingComponent(component: ReviewActionComponent): void {
    this.viewingComponent = component;
  }

  async createTransferWalletActionFromAsset(
    asset: TransferableAsset,
    targetWalletAddress: string,
    amount: bigint
  ): Promise<WalletAction> {
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
          amount,
          assetId: asset.ticker,
          to: targetWalletAddress,
        },
      };
    }

    throw new Error('Unsupported asset type');
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

    const actionResult = await this.doWalletAction(action);

    return {
      success: true,
      result: actionResult,
    };
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

  private async doWalletAction(action: WalletAction): Promise<any> {
    return await this.kaspaNetworkActionsService.doWalletAction(
      action,
      this.walletService.getCurrentWallet()!
    );
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
    return {
      isValidated: true,
    };
  }
}
