import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { KcIconComponent, KcSpinnerComponent, KcTooltipDirective } from '@kaspacom/ui-kit';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { ShortenAddressPipe } from '../../../../../pipes/shorten-address.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { KaspaPriceService } from '../../../../../services/kaspa-price.service';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';
import { EthereumWalletChainManager } from '../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { CHAIN_ID_LOGOS } from '../../../../shared/network-selection-modal/chain-id-logos';
import { NATIVE_TOKEN_COINGECKO_IDS, COINGECKO_PRICE_URL } from '../../../../shared/network-selection-modal/coingecko-native-ids';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    CommaFormatterPipe,
    ShortenAddressPipe,
    KcIconComponent,
    KcSpinnerComponent,
    KcTooltipDirective,
    SkeletonComponent,
    CopyButtonComponent,
  ],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss',
})
export class BalanceComponent {
  kasBalanceInput = input<number | null>(null);
  private walletService = inject(WalletService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private kaspaPriceService = inject(KaspaPriceService);
  private assetsManagerService = inject(AssetsManagerService);
  private chainManager = inject(EthereumWalletChainManager);
  private http = inject(HttpClient);

  protected readonly isRefreshing = signal(false);
  protected readonly l2NativePrice = signal<number>(0);

  isL2Display = computed(() => this.walletService.getIsL2DisplaySignal()());

  currentChainConfig = computed(() => {
    const chainId = this.chainManager.getCurrentChainSignal()();
    return chainId ? this.chainManager.getChainConfig(chainId.toLowerCase()) : null;
  });

  nativeTokenSymbol = computed(() => {
    if (!this.isL2Display()) return 'KAS';
    return this.currentChainConfig()?.nativeCurrency?.symbol || '?';
  });

  currentNetworkIcon = computed(() => {
    if (!this.isL2Display()) return null;
    const chainId = this.chainManager.getCurrentChainSignal()();
    if (!chainId) return null;
    const normalizedId = chainId.toLowerCase();
    return (
      this.chainManager.getChainEnvConfig(normalizedId)?.icon ||
      CHAIN_ID_LOGOS[normalizedId] ||
      null
    );
  });

  private _l2PriceEffect = effect(() => {
    const chainId = this.chainManager.getCurrentChainSignal()();
    const isL2 = this.walletService.getIsL2DisplaySignal()();
    if (!isL2 || !chainId) {
      this.l2NativePrice.set(0);
      return;
    }
    const normalizedId = chainId.toLowerCase();
    const symbol = this.chainManager.getChainConfig(normalizedId)?.nativeCurrency?.symbol?.toUpperCase();
    const geckoId = symbol ? NATIVE_TOKEN_COINGECKO_IDS[symbol] : undefined;
    if (!geckoId) {
      this.l2NativePrice.set(0);
      return;
    }
    const requestedChainId = chainId;
    firstValueFrom(
      this.http.get<Record<string, { usd?: number }>>(COINGECKO_PRICE_URL, {
        params: { ids: geckoId, vs_currencies: 'usd' },
      })
    ).then(resp => {
      if (this.chainManager.getCurrentChainSignal()() === requestedChainId) {
        this.l2NativePrice.set(resp[geckoId]?.usd ?? 0);
      }
    }).catch(() => {
      if (this.chainManager.getCurrentChainSignal()() === requestedChainId) {
        this.l2NativePrice.set(0);
      }
    });
  });

  walletAddress = this.walletService.getCurrentDisplayWalletAddressAsString;

  usdBalance = computed(() => {
    const balance = this.kasBalance();
    const price = this.isL2Display() ? this.l2NativePrice() : this.kaspaPriceService.price();
    if (balance === 0 || price === 0) return 0;
    return Math.round(balance * price * 1000) / 1000;
  });

  // Check if wallet data is loading
  isLoading = computed(() => {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      return true;
    }

    // If external balance is provided, loading is controlled by parent
    if (this.kasBalanceInput() !== null) {
      return false;
    }

    const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
    return !balanceData;
  });

  // Get the actual balance from the wallet based on network
  kasBalance = computed(() => {
    if (this.kasBalanceInput() !== null) {
      return this.kasBalanceInput() as number;
    }

    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      return 0;
    }

    const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
    if (!balanceData) {
      return 0;
    }

    if (this.walletService.isL2Display()) {
      return wallet.getL2WalletStateSignal()()!.balanceFormatted;
    }

    return this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature);
  });

  async onRefreshClick(event?: Event): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();

    if (this.isRefreshing() || this.isLoading()) {
      return;
    }

    this.isRefreshing.set(true);
    const wallet = this.walletService.getCurrentWallet();

    try {
      if (wallet) {
        const refreshTasks: Promise<unknown>[] = [wallet.refreshUtxosBalance()];

        if (this.walletService.isL2Display()) {
          refreshTasks.push(wallet.refreshL2Balance());
        }

        await Promise.all(refreshTasks);
      }

      this.kaspaPriceService.refreshPrice();
      this.assetsManagerService.reloadAllCurrentAssetsAfterUpdate();
    } catch (error) {
      console.error('Failed to refresh wallet balance', error);
    } finally {
      this.isRefreshing.set(false);
    }
  }
}
