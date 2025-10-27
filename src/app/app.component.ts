import { AfterViewInit, Component, OnInit, Renderer2, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import { NgIf } from '@angular/common';
import { environment } from '../environments/environment';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { MessagePopupComponent } from './components/message-popup/message-popup.component';
import { MessagePopupService } from './services/message-popup.service';
import { WalletService } from './services/wallet.service';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { EthereumWalletChainManager } from './services/etherium-services/etherium-wallet-chain.manager';
import { AssetsManagerService } from './services/assets-manager/assets-manager.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent, NgIf, MessagePopupComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService]
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'kaspiano-wallet';
  rpcConnectionRejectReason = '';
  walletService = inject(WalletService);
  messagePopupService = inject(MessagePopupService);
  communicationService = inject(CommunicationManagerService);
  kaspaConnectionService = inject(KaspaNetworkConnectionManagerService);
  ethereumWalletChainManager = inject(EthereumWalletChainManager);
  assetsManager = inject(AssetsManagerService);

  constructor(
    private readonly communicationManagerService: CommunicationManagerService, 
    private renderer: Renderer2) {
  }

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
    let loader = this.renderer.selectRootElement('#application-loader-startup');
    if (loader.style.display != "none") loader.style.display = "none"; //hide loader
    loader.remove();
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
}
