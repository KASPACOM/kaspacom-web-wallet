import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from 'kaspacom-ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../services/wallet.service';
import { Router } from '@angular/router';
import { CHAIN_ID_LOGOS } from './chain-id-logos';
import { COINGECKO_PRICE_URL, NATIVE_TOKEN_COINGECKO_IDS } from './coingecko-native-ids';
import { L1NetworkConfigInterface } from '../../../../environments/environment.interface';
import { RpcService } from '../../../services/kaspa-netwrok-services/rpc.service';
import { KaspaNetworkConnectionManagerService } from '../../../services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { KaspaL1NetworkService } from '../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { AppWallet } from '../../../classes/AppWallet';

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;


interface PriceCacheEntry {
  priceUsd: number;
  fetchedAt: number;
}

@Component({
  selector: 'network-selection-modal',
  imports: [CommonModule, KcIconComponent],
  templateUrl: './network-selection-modal.component.html',
  styleUrl: './network-selection-modal.component.scss',
})
export class NetworkSelectionModalComponent implements OnInit {
  private ethereumWalletChainManager = inject(EthereumWalletChainManager);
  private flowPagesService = inject(FlowPagesService);
  private walletService = inject(WalletService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private rpcService = inject(RpcService);
  private kaspaConnectionManagerService = inject(
    KaspaNetworkConnectionManagerService,
  );
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  protected l1Networks = this.kaspaL1NetworkService.getAvailableNetworks();
  private l1NetworkSwitchGeneration = 0;

  // Reactive: re-derives whenever a custom chain is added or removed
  protected networks = computed<EIP1193ProviderChain[]>(() => {
    void this.ethereumWalletChainManager.getCustomChainsSignal()();
    return Object.values(this.ethereumWalletChainManager.getAllChainsByChainId());
  });

  protected nativePrices = new Map<string, number>();
  protected deletingChainId: string | null = null;

  private priceCache = new Map<string, PriceCacheEntry>();

  isCurrentNetworkL2 = computed(() =>
    this.walletService.getIsL2DisplaySignal()(),
  );
  currentL2Network = computed(() =>
    this.ethereumWalletChainManager.getCurrentChainSignal()(),
  );
  currentL1Network = computed(() =>
    this.kaspaL1NetworkService.getCurrentNetworkSignal()(),
  );

  ngOnInit(): void {
    this.fetchAllNativePrices();
  }

  private async fetchAllNativePrices(): Promise<void> {
    const symbolToChainIds = new Map<string, string[]>();
    for (const network of this.networks()) {
      const symbol = network.nativeCurrency?.symbol?.toUpperCase();
      if (!symbol || !NATIVE_TOKEN_COINGECKO_IDS[symbol]) continue;
      const ids = symbolToChainIds.get(symbol) ?? [];
      ids.push(network.chainId);
      symbolToChainIds.set(symbol, ids);
    }

    const uniqueSymbols = [...symbolToChainIds.keys()];
    if (!uniqueSymbols.length) return;

    const geckoIdList = [...new Set(uniqueSymbols.map(s => NATIVE_TOKEN_COINGECKO_IDS[s]))];
    const geckoIds = geckoIdList.join(',');
    const now = Date.now();
    const allCached = geckoIdList.every(id => {
      const entry = this.priceCache.get(id);
      return entry && now - entry.fetchedAt < PRICE_CACHE_TTL_MS;
    });

    if (!allCached) {
      try {
        const resp = await firstValueFrom(
          this.http.get<Record<string, { usd?: number }>>(COINGECKO_PRICE_URL, {
            params: { ids: geckoIds, vs_currencies: 'usd' },
          }),
        );
        for (const geckoId of geckoIdList) {
          const price = resp[geckoId]?.usd;
          if (price !== undefined) {
            this.priceCache.set(geckoId, { priceUsd: price, fetchedAt: Date.now() });
          }
        }
      } catch {
        // price fetch is best-effort
      }
    }

    // Map prices back to chainIds
    for (const [symbol, chainIds] of symbolToChainIds) {
      const geckoId = NATIVE_TOKEN_COINGECKO_IDS[symbol];
      const entry = this.priceCache.get(geckoId);
      if (entry) {
        for (const chainId of chainIds) {
          this.nativePrices.set(chainId, entry.priceUsd);
        }
      }
    }
  }

  onClose(): void {
    this.flowPagesService.closePage();
  }

  onCloseAfterNetworkChanged(): void {
    this.router.navigate(['/app/home']);
    this.onClose();
  }

  getNetworkIcon(network: EIP1193ProviderChain): string | null {
    return (
      this.ethereumWalletChainManager.getChainEnvConfig(network.chainId)?.icon ||
      CHAIN_ID_LOGOS[network.chainId.toLowerCase()] ||
      null
    );
  }

  getNetworkShortName(network: EIP1193ProviderChain): string {
    const envConfig = this.ethereumWalletChainManager.getChainEnvConfig(
      network.chainId,
    );
    return envConfig?.shortName || network.chainName;
  }

  isCurrentNetwork(networkId: string): boolean {
    return (
      this.ethereumWalletChainManager.getCurrentChainSignal()()?.toLowerCase() === networkId.toLowerCase()
    );
  }

  isCustomNetwork(networkId: string): boolean {
    return this.ethereumWalletChainManager.isCustomChain(networkId);
  }

  getNativePrice(chainId: string): number | null {
    return this.nativePrices.get(chainId) ?? null;
  }

  isCurrentL1Network(network: L1NetworkConfigInterface): boolean {
    return (
      !this.isCurrentNetworkL2() &&
      this.currentL1Network().network === network.network
    );
  }

  async setL1Network(network: L1NetworkConfigInterface): Promise<void> {
    const switchGeneration = ++this.l1NetworkSwitchGeneration;
    const currentWallet = this.walletService.getCurrentWallet();
    currentWallet?.resetL1NetworkState();

    this.rpcService.setNetwork(network.network);
    this.walletService.setL2Display(false);
    this.ethereumWalletChainManager.setCurrentChain(undefined);
    this.onCloseAfterNetworkChanged();
    void this.reloadSelectedL1Network(currentWallet, switchGeneration);
  }

  private async reloadSelectedL1Network(
    currentWallet: AppWallet | undefined,
    switchGeneration: number,
  ): Promise<void> {
    await currentWallet?.stopListiningToWalletActions();
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    await this.kaspaConnectionManagerService
      .waitForConnection(true)
      .catch((err) => {
        console.warn('Failed connecting to selected Kaspa L1 network', err);
      });
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    await currentWallet?.refreshUtxosBalance();
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    currentWallet?.startListiningToWalletActions();
  }

  setL2Network(network: EIP1193ProviderChain): void {
    if (this.deletingChainId === network.chainId) return;
    this.ethereumWalletChainManager.setCurrentChain(network.chainId);
    this.walletService.setL2Display(true);
    this.onCloseAfterNetworkChanged();
  }

  onL1SpaceKey(event: Event, network: L1NetworkConfigInterface): void {
    event.preventDefault();
    this.setL1Network(network);
  }

  onNetworkEnterKey(event: Event, network: EIP1193ProviderChain): void {
    if (event.target !== event.currentTarget) return;
    this.setL2Network(network);
  }

  onNetworkSpaceKey(event: Event, network: EIP1193ProviderChain): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.setL2Network(network);
  }

  onAddNetworkSpaceKey(event: Event): void {
    event.preventDefault();
    this.onAddNetwork();
  }

  onAddNetwork(): void {
    this.flowPagesService.navigateToPage({
      id: 'add-custom-network',
      title: 'Add Custom Network',
      canNavigateBack: true,
      canClose: true,
      showTitle: true,
      showBackground: true,
    });
  }

  confirmDelete(event: MouseEvent, chainId: string): void {
    event.stopPropagation();
    if (this.deletingChainId === chainId) {
      const wasCurrentChain = this.isCurrentNetwork(chainId);
      this.ethereumWalletChainManager.removeChain(chainId);
      if (wasCurrentChain) {
        this.walletService.setL2Display(false);
      }
      this.deletingChainId = null;
    } else {
      this.deletingChainId = chainId;
    }
  }

  cancelDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deletingChainId = null;
  }

  formatPrice(price: number): string {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    if (price >= 1) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  }
}
