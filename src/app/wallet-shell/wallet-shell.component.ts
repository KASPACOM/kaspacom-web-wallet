import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { KcSnackbarComponent } from '@kaspacom/ui-kit';
import { StartupBackgroundCanvasComponent } from '../components/startup-background-canvas/startup-background-canvas.component';
import { environment } from '../../environments/environment';
import { AssetsManagerService } from '../services/assets-manager/assets-manager.service';
import { CommunicationManagerService } from '../services/communication-service/communication-manager.service';
import { IFrameCommunicationApp } from '../services/communication-service/communication-app/iframe-communication.service';
import { ConsentService } from '../services/consent.service';
import { EthereumWalletChainManager } from '../services/etherium-services/etherium-wallet-chain.manager';
import { KaspaNetworkActionsService } from '../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { KaspaNetworkConnectionManagerService } from '../services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { ReferralService } from '../services/referral.service';
import { WalletService } from '../services/wallet.service';
import { ReviewActionComponent } from '../components/wallet-actions-reviews/review-action/review-action.component';

@Component({
  selector: 'app-wallet-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    KcSnackbarComponent,
    StartupBackgroundCanvasComponent,
    ReviewActionComponent,
  ],
  templateUrl: './wallet-shell.component.html',
  styleUrl: './wallet-shell.component.scss',
  providers: [KaspaNetworkActionsService],
})
export class WalletShellComponent implements OnInit, OnDestroy {
  private readonly communicationManagerService = inject(
    CommunicationManagerService,
  );
  private readonly document = inject<Document>(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly referralService = inject(ReferralService);
  private iframeApp?: IFrameCommunicationApp;

  walletService = inject(WalletService);
  communicationService = inject(CommunicationManagerService);
  kaspaConnectionService = inject(KaspaNetworkConnectionManagerService);
  ethereumWalletChainManager = inject(EthereumWalletChainManager);
  assetsManager = inject(AssetsManagerService);
  consentService = inject(ConsentService);

  async ngOnInit() {
    try {
      this.applyIndexingPolicy();

      if (!this.isAllowedDomain()) {
        return;
      }

      this.referralService.captureReferralCode();

      let isIframe = false;
      try {
        isIframe = window.self !== window.top;
      } catch {
        isIframe = true;
      }

      if (isIframe) {
        this.document.body.classList.add('iframe-mode');
        const iframeApp = new IFrameCommunicationApp();
        if (iframeApp.getApplicationId()) {
          this.iframeApp = iframeApp;
          await this.communicationManagerService.addApp(iframeApp);
        } else {
          console.error(
            'Cannot establish iframe communication: parent origin is unknown. Ensure the embedding page allows the origin to be sent via the browser referrer policy.',
          );
        }
      }

      this.assetsManager.initializeWalletListenerAndStart();
    } finally {
      this.notifyWalletShellReady();
    }
  }

  ngOnDestroy(): void {
    if (this.iframeApp) {
      this.communicationManagerService.removeApp(this.iframeApp);
      this.iframeApp = undefined;
    }
    this.document.body.classList.remove('iframe-mode');
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

  private applyIndexingPolicy(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  private notifyWalletShellReady(): void {
    this.document.documentElement.setAttribute('data-wallet-shell-loaded', 'true');
    this.document.documentElement.setAttribute('data-wallet-shell-ready', 'true');
    window.dispatchEvent(new CustomEvent('wallet-shell-ready'));
  }
}
