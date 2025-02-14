import { EnvironmentInjector, inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { WalletActionService } from './wallet-action.service';
import { WalletService } from './wallet.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../classes/AppWallet';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';
import { Subscription } from 'rxjs';
import { CommitRevealAction, WalletAction } from '../types/wallet-action';
import { WalletActionResultWithError } from '../types/wallet-action-result';
import { ERROR_CODES, WalletActionRequestPayloadInterface, WalletActionTypeEnum, WalletMessageInterface, WalletMessageTypeEnum } from 'kaspacom-wallet-messages';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class IFrameCommunicationService {
  private walletBalanceObservableSubscription: undefined | Subscription =
    undefined;
  private currentWalletId: number | undefined = undefined;

  constructor(
    private walletActionsService: WalletActionService,
    private walletService: WalletService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly injector: EnvironmentInjector,
    private router: Router,
  ) {
    toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
      this.onWalletSelected.bind(this)
    );
  }

  isAllowedDomain(domain: string): boolean {
    const hostname = new URL(domain).hostname;
    return environment.allowedDomains.includes(hostname);
  }

  isIframe(): boolean {
    return (
      window.self !== window.top || window.location != window.parent.location
    );
  }

  isApplicationDomainAllowed(): boolean {
    if (!this.isIframe()) {
      return true;
    }

    const topUrl = this.getTopUrl();

    return this.isAllowedDomain(topUrl);
  }

  private getTopUrl() {
    return document.location.ancestorOrigins[0] || document.referrer;
  }

  private async sendMessageToApp(message: WalletMessageInterface) {
    if (!this.isApplicationDomainAllowed()) {
      throw new Error('Application domain not allowed');
    }

    window.parent.postMessage(message, this.getTopUrl());
  }

  initIframeMessaging() {
    this.initWalletEvents();
    window.addEventListener('message', async (event) => {
      if (!this.isAllowedDomain(event.origin)) {
        throw new Error('Application domain not allowed');
      }

      const message = event.data as WalletMessageInterface;

      if (message?.type) {
        switch (message.type) {
          case WalletMessageTypeEnum.WalletActionRequest:
            await this.handleWalletActionRequest(message.payload, message.uuid);
            break;
          case WalletMessageTypeEnum.OpenWalletInfo:
            this.router.navigate(['/wallet-info']);
            break;
          case WalletMessageTypeEnum.RejectWalletActionRequest: 
            this.walletActionsService.resolveCurrentWaitingForApproveAction(false);
            break;
        }
      }
    });
  }

  private initWalletEvents() { }

  private async onWalletSelected(wallet: AppWallet | undefined) {
    this.currentWalletId = wallet?.getId();
    if (!wallet && this.walletBalanceObservableSubscription) {
      this.walletBalanceObservableSubscription.unsubscribe();
      this.walletBalanceObservableSubscription = undefined;
    }

    if (wallet) {
      wallet.waitForUtxoProcessorToBeReady().then(() => {
        // if not changed wallet while we waited
        if (wallet.getId() == this.currentWalletId) {
          if (this.walletBalanceObservableSubscription) {
            this.walletBalanceObservableSubscription.unsubscribe();
            this.walletBalanceObservableSubscription = undefined;
          }

          this.walletBalanceObservableSubscription = toObservable(
            wallet.getWalletUtxoStateBalanceSignal(),
            { injector: this.injector }
          ).subscribe(this.onWalletBalanceUpdated.bind(this));
        }
      });
    }

    await this.sendUpdateWalletInfoEvent(wallet);
  }

  private async onWalletBalanceUpdated(balance: BalanceData | undefined) {
    await this.sendUpdateWalletInfoEvent(this.walletService.getCurrentWallet());
  }

  private async sendUpdateWalletInfoEvent(wallet: AppWallet | undefined) {
    const message: WalletMessageInterface = {
      type: WalletMessageTypeEnum.WalletInfo,
      payload: undefined,
    };

    if (wallet) {
      const balance = wallet.getUtxoProcessorManager()?.getContext()
        ?.balance;
      message.payload = {
        walletAddress: wallet.getAddress(),
        balance:
          balance?.mature === undefined
            ? null
            : {
              current: this.kaspaNetworkActionsService.sompiToNumber(balance.mature),
              pending: this.kaspaNetworkActionsService.sompiToNumber(balance.pending),
              outgoing: this.kaspaNetworkActionsService.sompiToNumber(balance.outgoing),
            },
      };
    }
    this.sendMessageToApp(message);
  }

  private async handleWalletActionRequest(
    actionData: WalletActionRequestPayloadInterface,
    uuid?: string
  ) {
    let result: WalletActionResultWithError = {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };

    if (!this.walletService.getCurrentWallet()) {
      result = {
        success: false,
        errorCode: ERROR_CODES.WALLET_ACTION.WALLET_NOT_SELECTED,
      }
    } else {
      if (actionData.action == WalletActionTypeEnum.GetProtocolScriptData) {
        result = {
          success: true,
          result: await this.kaspaNetworkActionsService.createGenericScriptFromString(
            actionData.data.type,
            actionData.data.stringifyAction,
            this.walletService.getCurrentWallet()!.getAddress(),
          ) as any,
        }
      } else {
        let action: WalletAction | undefined =
          this.getMessageWalletAction(actionData);

        if (action) {
          result = await this.walletActionsService.validateAndDoActionAfterApproval(
            action,
            true
          );
        }
      }
    }


    await this.sendMessageToApp({
      type: WalletMessageTypeEnum.WalletActionResponse,
      uuid,
      payload: result.success
        ? {
          action: actionData.action,
          success: true,
          data: result.result,
        }
        : {
          action: actionData.action,
          success: false,
          errorCode: result.errorCode || ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        } as any,
    });
  }

  private getMessageWalletAction(
    actionData: WalletActionRequestPayloadInterface
  ): WalletAction | undefined {
    switch (actionData.action) {
      case WalletActionTypeEnum.SignMessage:
        return this.walletActionsService.createSignMessageAction(
          actionData.data.message
        );

      case WalletActionTypeEnum.CommitReveal:

        const transformedData: CommitRevealAction = {
          actionScript: {
            stringifyAction: actionData.data.actionScript.stringifyAction,
            type: actionData.data.actionScript.type as any,
          },
          options: {
            ...actionData.data.options as any,
            additionalOutputs: actionData.data.options?.additionalOutputs?.map(
              (output) => ({
                ...output,
                amount: this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                  output.amount
                ),
              })
            ),
            revealPriorityFee: actionData.data.options?.revealPriorityFee ? this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
              actionData.data.options?.revealPriorityFee
            ) : undefined,
            revealPskt: actionData.data.options?.revealPskt ? {
              script: actionData.data.options?.revealPskt?.script,
              outputs: actionData.data.options?.revealPskt?.outputs?.map(
                (output) => ({
                  ...output,
                  amount: this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
                    output.amount
                  ),
                })
              )
            } : undefined,


          }
        }

        return this.walletActionsService.createCommitRevealAction(
          transformedData,
        );

      case WalletActionTypeEnum.KasTransfer:
        return this.walletActionsService.createTransferKasWalletAction(
          actionData.data.to,
          this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
            actionData.data.amount
          ),
          this.walletService.getCurrentWallet()!,
        );

      case WalletActionTypeEnum.SignPsktTransaction:
        return this.walletActionsService.createSignPsktAction(
          actionData.data.psktTransactionJson,
          actionData.data.submitTransaction,
          actionData.data.protocol,
          actionData.data.protocolAction,
        );
    }

    return undefined;
  }
}
