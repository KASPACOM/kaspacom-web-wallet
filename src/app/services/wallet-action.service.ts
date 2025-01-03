import { effect, Injectable, Signal, signal } from '@angular/core';
import {
  BuyKrc20PsktAction,
  Krc20Action,
  SignMessage,
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
import { ReviewActionComponent } from '../components/wallet-actions-reviews/review-action/review-action.component';
import {
  WalletActionResult,
  WalletActionResultWithError,
} from '../types/wallet-action-result';
import { Krc20OperationDataService } from './kaspa-netwrok-services/krc20-operation-data.service';
import {
  KRC20OperationDataInterface,
  KRC20OperationType,
} from '../types/kaspa-network/krc20-operations-data.interface';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';
import { TokenState } from './kasplex-api/dtos/token-list-info.dto';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { AppWallet } from '../classes/AppWallet';
import { toObservable } from '@angular/core/rxjs-interop';
import { PsktTransaction } from '../types/kaspa-network/pskt-transaction.interface';
import { OperationDetailsResponse } from './kasplex-api/dtos/operation-details-response';

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
    private krc20OperationDataService: Krc20OperationDataService,
    private kasplexService: KasplexKrc20Service
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
            wallet.getWalletUtxoStateBalanceSignal()()?.mature &&
            wallet.getWalletUtxoStateBalanceSignal()()?.mature == amount,
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

  createDeployWalletAction(
    ticker: string,
    maxSupply: bigint,
    limitPerMint: bigint,
    preAllocation: bigint
  ): WalletAction {
    return {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData: this.krc20OperationDataService.getDeployData(
          ticker,
          maxSupply,
          limitPerMint,
          preAllocation
        ),
      },
    };
  }

  createCompoundUtxosAction(): WalletAction {
    return {
      type: WalletActionType.COMPOUND_UTXOS,
      data: {},
    };
  }

  createUnfinishedKrc20Action(
    operationData: KRC20OperationDataInterface
  ): WalletAction {
    return {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData,
        revealOnly: true,
      },
    };
  }

  createListKrc20Action(
    ticker: string,
    amount: bigint,
    totalPrice: bigint,
    commission?: {
      address: string;
      amount: bigint;
    }
  ): WalletAction {
    return {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData: this.krc20OperationDataService.getListData(
          ticker,
          amount
        ),
        psktData: {
          totalPrice,
          commission,
        },
      },
    };
  }

  createBuyKrc20Action(
    psktDataJson: string,
    signOnly: boolean = false
  ): WalletAction {
    return {
      type: WalletActionType.BUY_KRC20_PSKT,
      data: {
        psktTransactionJson: psktDataJson,
        signOnly,
      },
    };
  }

  createCancelListingKrc20Action(
    ticker: string,
    transactionId: string,
    amount: bigint
  ): WalletAction {
    return {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData: this.krc20OperationDataService.getSendData(ticker),
        revealOnly: true,
        isCancel: true,
        transactionId,
        amount,
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
  ): Promise<{ success: boolean; errorCode?: number; result?: any }> {
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
      this.showTransactionLoaderToUser(
        Math.round((currentStep / actionSteps) * 100)
      );

      currentStep++;
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

  private async validateAction(
    action: WalletAction,
    wallet: AppWallet
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

    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
        validationResult = await this.validateTransferKasAction(
          action.data as TransferKasAction,
          wallet
        );
        break;
      case WalletActionType.KRC20_ACTION:
        validationResult = await this.validateKrc20Action(
          action.data as Krc20Action,
          wallet
        );
        break;
      case WalletActionType.COMPOUND_UTXOS:
        validationResult = await this.validateCompoundUtxosAction(wallet);
        break;

      case WalletActionType.BUY_KRC20_PSKT:
        validationResult = await this.validateBuyKrc20PsktAction(
          action.data as BuyKrc20PsktAction,
          wallet
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
      action.type != WalletActionType.SIGN_MESSAGE
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

  private async validateBuyKrc20PsktAction(
    action: BuyKrc20PsktAction,
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

    const sendTransactionId = transaction.inputs?.[0]?.transactionId;
    const sellerWalletAddressScript = transaction.outputs?.[0]?.scriptPublicKey;

    if (!(sendTransactionId && sellerWalletAddressScript)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
      };
    }

    let sellerWalletAddress: string;

    try {
      sellerWalletAddress =
        this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(
          sellerWalletAddressScript
        );
    } catch (error) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
      };
    }

    let operationDetails: OperationDetailsResponse;

    try {
      operationDetails = await firstValueFrom(
        this.kasplexService.getOperationDetails(sendTransactionId)
      );
    } catch (error) {
      console.error(error);

      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
      };
    }

    if (!operationDetails?.result?.[0]) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
      };
    }

    try {
      const isTransactionStillExists =
        await this.kasplexService.isListingStillExists(
          operationDetails.result[0].tick,
          sellerWalletAddress,
          sendTransactionId
        );

      if (!isTransactionStillExists) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.SEND_TRANSACTION_ALREADY_SPENT,
        };
      }
    } catch (error) {
      console.error(error);

      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
      };
    }

    return {
      isValidated: true,
    };
  }

  private async validateKrc20Action(
    action: Krc20Action,
    wallet: AppWallet
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (
      action.revealOnly &&
      action.operationData.op != KRC20OperationType.SEND
    ) {
      const hasAction =
        await this.kaspaNetworkActionsService.doesUnfinishedActionHasKasInScriptWallet(
          wallet,
          action.operationData
        );

      if (!hasAction) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.REVEAL_WITH_NO_COMMIT_ACTION,
        };
      }
    }

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

      let currentBalance;

      try {
        const response = await firstValueFrom(
          this.kasplexService.getTokenWalletBalanceInfo(
            wallet.getAddress(),
            action.operationData.tick
          )
        );

        if (!response?.result?.[0]) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
          };
        }

        currentBalance = response.result[0];
      } catch (error) {
        console.error(error);

        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
        };
      }

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

      return { isValidated: true };
    }

    if (action.operationData.op == KRC20OperationType.MINT) {
      let tokenData;

      try {
        tokenData = await firstValueFrom(
          this.kasplexService.getTokenInfo(action.operationData.tick)
        );
      } catch (error) {
        console.error(error);

        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
        };
      }

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

    if (action.operationData.op == KRC20OperationType.LIST) {
      if (this.utils.isNullOrEmptyString(action.operationData.amt!)) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
        };
      }

      if (BigInt(action.operationData.amt!) <= 0n) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
        };
      }

      if (!(action.psktData?.totalPrice && action.psktData.totalPrice > 0n)) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
        };
      }

      let currentBalance;

      try {
        const response = await firstValueFrom(
          this.kasplexService.getTokenWalletBalanceInfo(
            wallet.getAddress(),
            action.operationData.tick
          )
        );

        if (!response?.result?.[0]) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
          };
        }

        currentBalance = response.result[0];
      } catch (error) {
        console.error(error);

        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
        };
      }

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

      return { isValidated: true };
    }

    if (action.operationData.op == KRC20OperationType.DEPLOY) {
      if (
        this.utils.isNullOrEmptyString(action.operationData.tick) ||
        this.utils.isNullOrEmptyString(action.operationData.max) ||
        this.utils.isNullOrEmptyString(action.operationData.lim) ||
        this.utils.isNullOrEmptyString(action.operationData.pre) ||
        !this.utils.isNumberString(action.operationData.max!) ||
        !this.utils.isNumberString(action.operationData.lim!) ||
        !this.utils.isNumberString(action.operationData.pre!)
      ) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
        };
      }

      if (
        BigInt(action.operationData.max!) <= 0n ||
        BigInt(action.operationData.lim!) <= 0n ||
        BigInt(action.operationData.max!) < BigInt(action.operationData.lim!) ||
        BigInt(action.operationData.max!) < BigInt(action.operationData.pre!) ||
        (BigInt(action.operationData.pre!) &&
          (BigInt(action.operationData.pre!) < 0n ||
            BigInt(action.operationData.pre!) >
              BigInt(action.operationData.max!)))
      ) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
        };
      }

      if (
        !(
          action.operationData.tick.length >= 4 &&
          action.operationData.tick.length <= 6
        )
      ) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
        };
      }

      let tickerInfoResult;

      try {
        tickerInfoResult = await firstValueFrom(
          this.kasplexService.getTokenInfo(action.operationData.tick)
        );
      } catch (error) {
        console.error(error);

        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
        };
      }

      if (!tickerInfoResult.result?.[0]) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
        };
      }

      const tickerData = tickerInfoResult.result?.[0];

      if (tickerData.state != TokenState.UNUSED) {
        return {
          isValidated: false,
          errorCode:
            ERROR_CODES.WALLET_ACTION.TOKEN_NAME_IS_NOT_AVAILABLE_TO_DEPLOY,
        };
      }

      return { isValidated: true };
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
