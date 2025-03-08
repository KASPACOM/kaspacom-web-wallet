import { EnvironmentInjector, inject, Injectable } from '@angular/core';
import { WalletActionService } from './wallet-action.service';
import { WalletService } from './wallet.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../classes/AppWallet';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';
import { Subscription } from 'rxjs';
import { CommitRevealAction, WalletAction } from '../types/wallet-action';
import { WalletActionResultWithError } from '../types/wallet-action-result';
import { ConnectAppActionResult, ERROR_CODES, WalletActionRequestPayloadInterface, WalletActionResultType, WalletActionTypeEnum, WalletMessageInterface, WalletMessageTypeEnum } from 'kaspacom-wallet-messages';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class PostMessageCommunicationService {
  private walletBalanceObservableSubscription: undefined | Subscription =
    undefined;
  private currentWalletId: number | undefined = undefined;
  private connectedApps: { [appUrl: string]: MessageEventSource | null } = {};

  constructor(
    private walletActionsService: WalletActionService,
    private walletService: WalletService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly injector: EnvironmentInjector,
    private router: Router,
  ) {
    if (this.getOpenerWindow()) {
      toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
        this.onWalletSelected.bind(this)
      );
    }
  }

  isIframe(): boolean {
    return (
      window.self !== window.top || window.location != window.parent.location
    );
  }


  getOpenerWindow() {
    return window.opener || window.parent;
  }

  shouldBeActivated() {
    return !!this.getOpenerWindow();
  }

  private getTopUrl() {
    return document.location.ancestorOrigins[0] || document.referrer;
  }

  private async sendMessageToApp(message: WalletMessageInterface, origin?: string) {
    console.log('Sending message', origin, message);
    if (origin) {
      this.connectedApps[origin]?.postMessage(message, {
        targetOrigin: origin,
      });
    } else {
      for (let connectedApp in this.connectedApps) {
        this.connectedApps[connectedApp]?.postMessage(message, {
          targetOrigin: connectedApp,
        });
      }
    }
  }

  initPostMessagesIfNeeded() {
    if (!this.shouldBeActivated()) {
      return;
    }

    window.addEventListener('message', async (event) => {
      console.log('messageReceived', event.origin, event);
      const message = event.data as WalletMessageInterface;

      const isConnectionRequest = message?.type == WalletMessageTypeEnum.WalletActionRequest && message?.payload?.action == WalletActionTypeEnum.ConnectApp;


      if (isConnectionRequest) {
        await this.handleWalletActionRequest(message.payload, event, message.uuid);
      }

      if (!this.isApplicationAllowed(event.origin)) {
        console.error('Message from disallowed domain', event);
        throw new Error('Application domain not allowed');
      }


      if (message?.type) {
        switch (message.type) {
          case WalletMessageTypeEnum.WalletActionRequest:
            await this.handleWalletActionRequest(message.payload, event, message.uuid);
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

    this.getOpenerWindow().postMessage("ready", "*");
  }

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

  private async sendUpdateWalletInfoEvent(wallet: AppWallet | undefined, origin?: string) {
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
    this.sendMessageToApp(message, origin);
  }

  private async emitInitialDataForConnectedApp(origin: string) {
    if (this.walletService.getCurrentWallet()) {
      await this.sendUpdateWalletInfoEvent(this.walletService.getCurrentWallet(), origin);
    }
  }

  private async handleWalletActionRequest(
    actionData: WalletActionRequestPayloadInterface,
    event: MessageEvent<any>,
    uuid?: string,
  ) {
    let result: WalletActionResultWithError = {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };

    if (actionData?.action == WalletActionTypeEnum.ConnectApp) {
      this.connectedApps[event.origin] = event.source;
      this.emitInitialDataForConnectedApp(event.origin);

      console.log('adding connected app');

      result = {
        success: true,
        result: {
          isApproved: true,
        } as ConnectAppActionResult
      };
    } else {
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
              true,
              async () => {
                this.sendMessageToApp({
                  type: WalletMessageTypeEnum.WalletActionApproved,
                  uuid,
                  payload: actionData,
                }, event.origin);
              }
            );
          }
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
    }, event.origin);

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

  isApplicationAllowed(appUrl: string): boolean {
    return Object.keys(this.connectedApps).includes(appUrl);
  }
}
