import {
  AfterViewInit,
  Component,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import { DOCUMENT, NgIf } from '@angular/common';
import { environment } from '../environments/environment';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { MessagePopupComponent } from './components/message-popup/message-popup.component';
import { MessagePopupService } from './services/message-popup.service';
import { WalletService } from './services/wallet.service';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { EthereumWalletChainManager } from './services/etherium-services/etherium-wallet-chain.manager';
import { AssetsManagerService } from './services/assets-manager/assets-manager.service';
import { StartupBackgroundCanvasComponent } from './components/startup-background-canvas/startup-background-canvas.component';
import { ConsentService } from './services/consent.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    AppHeaderComponent,
    NgIf,
    MessagePopupComponent,
    StartupBackgroundCanvasComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'kaspiano-wallet';
  rpcConnectionRejectReason = '';
  walletService = inject(WalletService);
  messagePopupService = inject(MessagePopupService);
  communicationService = inject(CommunicationManagerService);
  kaspaConnectionService = inject(KaspaNetworkConnectionManagerService);
  ethereumWalletChainManager = inject(EthereumWalletChainManager);
  assetsManager = inject(AssetsManagerService);
  consentService = inject(ConsentService);
  private teardownLoader?: VoidFunction;

  constructor(
    private readonly communicationManagerService: CommunicationManagerService,
    private readonly renderer: Renderer2,
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly zone: NgZone,
  ) {}

  async ngOnInit() {
    console.log('App component initialized');
    if (!this.isAllowedDomain()) {
      return;
    }

    if (IFrameCommunicationApp.isIframe()) {
      this.communicationManagerService.addApp(new IFrameCommunicationApp());
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
