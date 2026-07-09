import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, NgZone, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import { environment } from '../environments/environment';
import { MessagePopupComponent } from './components/message-popup/message-popup.component';
import { StartupBackgroundCanvasComponent } from './components/startup-background-canvas/startup-background-canvas.component';
import { AssetsManagerService } from './services/assets-manager/assets-manager.service';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { ConsentService } from './services/consent.service';
import { EthereumWalletChainManager } from './services/etherium-services/etherium-wallet-chain.manager';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { MessagePopupService } from './services/message-popup.service';
import { ReferralService } from './services/referral.service';
import { WalletService } from './services/wallet.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MessagePopupComponent,
    StartupBackgroundCanvasComponent
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly communicationManagerService = inject(CommunicationManagerService);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly zone = inject(NgZone);

  title = 'kaspiano-wallet';
  rpcConnectionRejectReason = '';
  walletService = inject(WalletService);
  messagePopupService = inject(MessagePopupService);
  communicationService = inject(CommunicationManagerService);
  kaspaConnectionService = inject(KaspaNetworkConnectionManagerService);
  ethereumWalletChainManager = inject(EthereumWalletChainManager);
  assetsManager = inject(AssetsManagerService);
  consentService = inject(ConsentService);
  private readonly meta = inject(Meta);
  private referralService = inject(ReferralService);
  private teardownLoader?: VoidFunction;

  async ngOnInit() {
    console.log('App component initialized');

    this.applyIndexingPolicy();

    if (!this.isAllowedDomain()) {
      return;
    }

    this.referralService.captureReferralCode();

    let isIframe = false;
    try {
      // Use a safe, non-throwing iframe detection that doesn't depend on cross-origin-sensitive APIs.
      isIframe = window.self !== window.top;
    } catch {
      // If even this check fails due to unusual iframe restrictions, assume we are in an iframe.
      isIframe = true;
    }

    if (isIframe) {
      this.document.body.classList.add('iframe-mode');
      const iframeApp = new IFrameCommunicationApp();
      if (iframeApp.getApplicationId()) {
        this.communicationManagerService.addApp(iframeApp);
      } else {
        console.error(
          'Cannot establish iframe communication: parent origin is unknown. Ensure the embedding page allows the origin to be sent via the browser referrer policy (e.g., appropriate Referrer-Policy header or <iframe referrerpolicy>), so the standard Referer header and document.referrer are available.',
        );
      }
    }

    this.assetsManager.initializeWalletListenerAndStart();
  }

  ngAfterViewInit(): void {
    this.teardownLoader = this.setupLoaderFadeOut();
  }

  ngOnDestroy(): void {
    if (this.teardownLoader) {
      this.teardownLoader();
      this.teardownLoader = undefined;
    }
  }

  isAllowedDomain(): boolean {
    return environment.allowedDomains.includes(window.location.hostname);
  }

  // Only the canonical production host should be indexed by search engines.
  // dev-wallet.kaspa.com, localhost and preview hosts get noindex,nofollow.
  private applyIndexingPolicy(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.location.hostname !== 'wallet.kaspa.com') {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }
  }

  incompatibleBrowserReason(): string | undefined {
    if (!(window.crypto && window.crypto?.subtle)) {
      return 'Crypto not supported';
    }

    return undefined;
  }

  getCurrentHostname(): string {
    return window.location.hostname;
  }

  private setupLoaderFadeOut(): VoidFunction | undefined {
    return this.zone.runOutsideAngular(() => {
      const loader = this.document.getElementById('application-loader-startup');
      if (!loader) {
        return;
      }

      this.renderer.addClass(loader, 'fade-out');

      const cleanupFns: VoidFunction[] = [];
      let isFinalized = false;

      const finalizeRemoval = () => {
        if (isFinalized) {
          return;
        }
        isFinalized = true;

        cleanupFns.splice(0).forEach((cleanup) => cleanup());

        const parent = loader.parentNode;
        if (parent) {
          this.renderer.removeChild(parent, loader);
        } else if (
          loader instanceof HTMLElement &&
          typeof loader.remove === 'function'
        ) {
          loader.remove();
        }
      };

      const transitionCleanup = this.renderer.listen(
        loader,
        'transitionend',
        (event: TransitionEvent) => {
          if (event.target === loader && event.propertyName === 'opacity') {
            finalizeRemoval();
          }
        },
      );
      cleanupFns.push(transitionCleanup);

      const timeoutId = setTimeout(finalizeRemoval, 800);
      cleanupFns.push(() => clearTimeout(timeoutId));

      return () => {
        this.zone.runOutsideAngular(finalizeRemoval);
      };
    });
  }
}
