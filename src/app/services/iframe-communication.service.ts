import { EnvironmentInjector, inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { WalletActionService } from './wallet-action.service';
import { WalletService } from './wallet.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../classes/AppWallet';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';
import { Subscription } from 'rxjs';
import {
  ERROR_CODES,
  WalletActionTypeEnum,
  WalletMessageInterface,
  WalletMessageTypeEnum,
} from 'kaspacom-wallet-messages';
import { WalletActionRequestPayloadInterface } from 'kaspacom-wallet-messages/dist/types/payloads/actions/wallet-action-request-payload-interface';
import { WalletAction } from '../types/wallet-action';
import { WalletActionResultWithError } from '../types/wallet-action-result';

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
    private readonly injector: EnvironmentInjector
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

      console.log('WALLET GOT EVENT', event);

      const message = event.data as WalletMessageInterface;

      if (message?.type) {
        switch (message.type) {
          case WalletMessageTypeEnum.WalletActionRequest:
            await this.handleWalletActionRequest(message.payload, message.uuid);
            break;
        }
      }
    });
  }

  private initWalletEvents() {}

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
      payload: null,
    };

    if (wallet) {
      const balance = wallet.getUtxoProcessorManager()?.getContext()
        ?.balance?.mature;
      message.payload = {
        walletAddress: wallet.getAddress(),
        balance:
          balance === undefined
            ? null
            : this.kaspaNetworkActionsService.sompiToNumber(balance),
      };
    }
    this.sendMessageToApp(message);
  }

  private async handleWalletActionRequest(
    actionData: WalletActionRequestPayloadInterface,
    uuid?: string
  ) {
    let action: WalletAction | undefined =
      this.getMessageWalletAction(actionData);

    let result: WalletActionResultWithError = {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };

    if (action) {
      result = await this.walletActionsService.validateAndDoActionAfterApproval(
        action
      );
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
        break;
    }

    return undefined;
  }
}
