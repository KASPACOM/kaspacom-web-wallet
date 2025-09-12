import { AfterViewInit, Component, OnInit, Renderer2, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PasswordManagerService } from './services/password-manager.service';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import {  NgIf } from '@angular/common';
import { environment } from '../environments/environment';
import { IFrameCommunicationApp } from './services/communication-service/communication-app/iframe-communication.service';
import { CommunicationManagerService } from './services/communication-service/communication-manager.service';
import { MessagePopupComponent } from './components/message-popup/message-popup.component';
import { MessagePopupService } from './services/message-popup.service';
import { WalletService } from './services/wallet.service';
import { RpcConnectionStatus } from './types/kaspa-network/rpc-connection-status.enum';
import { toObservable } from '@angular/core/rxjs-interop';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { EthereumWalletChainManager } from './services/etherium-services/etherium-wallet-chain.manager';
import { AssetsStoreService } from './services/assets-store.service';
import { combineLatest } from 'rxjs';

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
  assetsStore = inject(AssetsStoreService);

  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService,
    private readonly communicationManagerService: CommunicationManagerService,
    private renderer: Renderer2) {
  }

  async ngOnInit() {
    console.log('App component initialized');
    
    // Initialize assets store testing
    this.initializeAssetsStoreTesting();

    if (!this.isAllowedDomain()) {
      return;
    }

    if (IFrameCommunicationApp.isIframe()) {
      this.communicationManagerService.addApp(new IFrameCommunicationApp());
    }

    // if (this.passwordManagerService.isUserHasSavedPassword()) {
    //   this.router.navigate(['/login']);
    // } else {
    //   this.router.navigate(['/set-password']);
    // }
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

  private initializeAssetsStoreTesting(): void {
    console.log('[AppComponent] Initializing assets store testing...');
    
    // Subscribe to all assets changes
    toObservable(this.assetsStore.allAssets).subscribe((assets) => {
      console.log('[AssetsStore Test] All assets updated:', assets);
    });
    
    // Subscribe to loading states
    toObservable(this.assetsStore.loadingStates).subscribe((states) => {
      console.log('[AssetsStore Test] Loading states:', states);
    });
    
    // Subscribe to individual asset types
    toObservable(this.assetsStore.kaspaAssets).subscribe((kaspa) => {
      if (kaspa) {
        console.log('[AssetsStore Test] Kaspa balance:', {
          totalBalance: kaspa.totalBalance.toString(),
          utxoCount: kaspa.utxoEntries.length
        });
      }
    });
    
    toObservable(this.assetsStore.krc20Assets).subscribe((tokens) => {
      console.log('[AssetsStore Test] KRC20 tokens count:', tokens.length);
      if (tokens.length > 0) {
        console.log('[AssetsStore Test] Sample KRC20 tokens:', tokens.slice(0, 5));
      }
    });
    
    toObservable(this.assetsStore.krc721Assets).subscribe((nfts) => {
      console.log('[AssetsStore Test] KRC721 NFTs count:', nfts.length);
      if (nfts.length > 0) {
        console.log('[AssetsStore Test] Sample NFTs:', nfts.slice(0, 5));
      }
    });
    
    toObservable(this.assetsStore.knsAssets).subscribe((domains) => {
      console.log('[AssetsStore Test] KNS domains count:', domains.length);
      if (domains.length > 0) {
        console.log('[AssetsStore Test] Sample domains:', domains.slice(0, 5));
      }
    });
    
    // Test methods after 5 seconds
    setTimeout(() => {
      console.log('[AssetsStore Test] Testing getter methods...');
      console.log('[AssetsStore Test] Asset values:', this.assetsStore.getAllAssetValues());
      console.log('[AssetsStore Test] Is any loading?', this.assetsStore.isAnyAssetLoading());
      console.log('[AssetsStore Test] KRC20 loading?', this.assetsStore.isAssetTypeLoading('krc20'));
      
      // Test reload of specific asset type
      console.log('[AssetsStore Test] Reloading KRC20 tokens...');
      this.assetsStore.reloadKrc20().then(() => {
        console.log('[AssetsStore Test] KRC20 reload completed');
      });
    }, 5000);
  }

}
