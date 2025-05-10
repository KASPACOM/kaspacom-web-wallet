import { EnvironmentInjector, Injectable } from '@angular/core';
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
import { EIP1193ProviderEventEnum, EIP1193ProviderRequestActionResult, ERROR_CODES, WalletActionRequestPayloadInterface, WalletActionResultType, WalletActionTypeEnum, WalletMessageInterface, WalletMessageTypeEnum } from 'kaspacom-wallet-messages';
import { Router } from '@angular/router';
import { EthereumWalletService } from './ethereum-wallet.service';

@Injectable({
  providedIn: 'root',
})
export class IFrameCommunicationService {
  private walletBalanceObservableSubscription: undefined | Subscription =
    undefined;
  private currentWalletIdWithAccount: string | undefined = undefined;

  constructor(
    private walletActionsService: WalletActionService,
    private walletService: WalletService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly injector: EnvironmentInjector,
    private router: Router,
    private ethereumWalletService: EthereumWalletService,
  ) {
    if (this.isIframe()) {
      toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
        this.onWalletSelected.bind(this)
      );
      toObservable(this.ethereumWalletService.getCurrentChainSignal()).subscribe(
        () => {
          this.sendEtheriumWalletEvent(EIP1193ProviderEventEnum.CHAIN_CHANGED);
        }
      );
    }
  }

  isIframeAllowedDomain(domain: string): boolean {
    const hostname = new URL(domain).hostname;
    return environment.allowedIframeDomains.includes(hostname);
  }

  isIframe(): boolean {
    return (
      window.self !== window.top || window.location != window.parent.location
    );
  }

  isIframeApplicationDomainAllowed(): boolean {
    const topUrl = this.getTopUrl();

    return this.isIframeAllowedDomain(topUrl);
  }

  private getTopUrl() {
    return document.location.ancestorOrigins[0] || document.referrer;
  }

  private async sendMessageToApp(message: WalletMessageInterface) {
    if (!this.isIframeApplicationDomainAllowed()) {
      throw new Error('Application domain not allowed');
    }

    window.parent.postMessage(message, this.getTopUrl());
  }

  initIframeMessaging() {
    this.initWalletEvents();
    window.addEventListener('message', async (event) => {

      if (!this.isIframeAllowedDomain(event.origin)) {
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
    if (wallet?.getIdWithAccount() != this.currentWalletIdWithAccount) {
      this.walletBalanceObservableSubscription?.unsubscribe();
      this.walletBalanceObservableSubscription = undefined;
    }

    this.currentWalletIdWithAccount = wallet?.getIdWithAccount();


    if (wallet && !this.walletBalanceObservableSubscription) {
        this.walletBalanceObservableSubscription = toObservable(
          wallet.getWalletUtxoStateBalanceSignal(),
          { injector: this.injector }
        ).subscribe(this.onWalletBalanceUpdated.bind(this));
    }

    this.sendUpdateWalletInfoEvent(wallet);
    this.sendEtheriumWalletEvent(EIP1193ProviderEventEnum.ACCOUNTS_CHANGED);
  }

  private async onWalletBalanceUpdated(balance: undefined | BalanceData) {
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
        kasplexL2Address: wallet.getL2WalletStateSignal()()?.address,
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
      } else if (actionData.action == WalletActionTypeEnum.EIP1193ProviderRequest) {
        result = {
          success: true,
          result: {
            type: WalletActionResultType.EIP1193ProviderRequest,
            performedByWallet: this.walletService.getCurrentWallet()!.getAddress(),
            result: await this.ethereumWalletService.handleRequest(actionData.data),
          } as EIP1193ProviderRequestActionResult<any>,
        }
      } else {
        let action: WalletAction | undefined =
          this.getMessageWalletAction(actionData);

        if (action) {
          result = await this.walletActionsService.validateAndDoActionAfterApproval(
            action,
            true,
            async () => {
              this.sendMessageToApp({
                type: WalletMessageTypeEnum.WalletActionApproved,
                uuid,
                payload: actionData,
              })
            }
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
      
      case WalletActionTypeEnum.SignL2EtherTransaction:
        return this.walletActionsService.createSignL2EtherTransactionAction(
          actionData.data.transactionOptions,
          actionData.data.payloadPrefix,
          actionData.data.submitTransaction,
          actionData.data.sendToL1
        );
    }

    return undefined;
  }

  async sendEtheriumWalletEvent(event: EIP1193ProviderEventEnum) {
    const eventData = await this.ethereumWalletService.getEventData(event);
    
    await this.sendMessageToApp({
      type: WalletMessageTypeEnum.EIP1193Event,
      payload: eventData,
    });
  }
}
