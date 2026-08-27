import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  DOCUMENT,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { KcSnackbarComponent } from '@kaspacom/ui-kit';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import { environment } from '../environments/environment';
import { StartupBackgroundCanvasComponent } from './components/startup-background-canvas/startup-background-canvas.component';
import { AssetsManagerService } from './services/assets-manager/assets-manager.service';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { ConsentService } from './services/consent.service';
import { EthereumWalletChainManager } from './services/etherium-services/etherium-wallet-chain.manager';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { ReferralService } from './services/referral.service';
import { WalletService } from './services/wallet.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    KcSnackbarComponent,
    StartupBackgroundCanvasComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  // The wallet/network stack below (WalletService -> RPC client, etc.) touches
  // browser-only APIs (localStorage, a browser-targeted WASM module) as soon as
  // it's constructed. It must never be instantiated on the server: SSR only
  // needs to render the static shell for a given route, the real wallet
  // runtime spins up once the client hydrates.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly communicationManagerService = this.isBrowser
    ? inject(CommunicationManagerService)
    : undefined;
  private readonly renderer = inject(Renderer2);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly zone = inject(NgZone);

  title = 'kaspiano-wallet';
  rpcConnectionRejectReason = '';
  walletService = this.isBrowser ? inject(WalletService) : undefined;
  communicationService = this.isBrowser
    ? inject(CommunicationManagerService)
    : undefined;
  kaspaConnectionService = this.isBrowser
    ? inject(KaspaNetworkConnectionManagerService)
    : undefined;
  ethereumWalletChainManager = this.isBrowser
    ? inject(EthereumWalletChainManager)
    : undefined;
  assetsManager = this.isBrowser ? inject(AssetsManagerService) : undefined;
  consentService = this.isBrowser ? inject(ConsentService) : undefined;
  private readonly meta = inject(Meta);
  private referralService = this.isBrowser
    ? inject(ReferralService)
    : undefined;
  private teardownLoader?: VoidFunction;

  async ngOnInit() {
    console.log('App component initialized');

    this.applyIndexingPolicy();

    if (!this.isBrowser) {
      return;
    }

    if (!this.isAllowedDomain()) {
      return;
    }

    this.referralService!.captureReferralCode();

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
        this.communicationManagerService!.addApp(iframeApp);
      } else {
        console.error(
          'Cannot establish iframe communication: parent origin is unknown. Ensure the embedding page allows the origin to be sent via the browser referrer policy (e.g., appropriate Referrer-Policy header or <iframe referrerpolicy>), so the standard Referer header and document.referrer are available.',
        );
      }
    }

    this.assetsManager!.initializeWalletListenerAndStart();
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
    // No hostname to check on the server (prerendering/SSR) — let the shell
    // render so the router-outlet's content is what gets prerendered.
    if (!this.isBrowser) {
      return true;
    }
    return environment.allowedDomains.includes(window.location.hostname);
  }

  // Only the canonical production host should be indexed by search engines.
  // dev-wallet.kaspa.com, localhost and preview hosts get noindex,nofollow.
  // Checked against environment.isProduction first (not just
  // window.location.hostname) because prerendering runs at build time with
  // no `window` — a dev-config build must ship noindex baked into the static
  // HTML itself, not rely on a client-side check that never runs for a
  // crawler that doesn't execute JavaScript.
  private applyIndexingPolicy(): void {
    if (!environment.isProduction) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
      return;
    }
    if (!this.isBrowser) {
      return;
    }
    if (window.location.hostname !== 'wallet.kaspa.com') {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }
  }

  incompatibleBrowserReason(): string | undefined {
    if (!this.isBrowser) {
      return undefined;
    }
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
