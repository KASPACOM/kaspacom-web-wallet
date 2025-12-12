import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { KcIconComponent, KcSpinnerComponent, KcTooltipDirective } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { KaspaPriceService } from '../../../../../services/kaspa-price.service';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';

@Component({
  selector: 'app-balance',
  imports: [
    DecimalPipe,
    CommaFormatterPipe,
    KcIconComponent,
    KcSpinnerComponent,
    KcTooltipDirective,
    SkeletonComponent,
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

  protected readonly isRefreshing = signal(false);

  walletAddress = this.walletService.getCurrentDisplayWalletAddressAsString;

  // Calculate USD balance by multiplying kasBalance * kaspaPrice with max 3 decimal rounding
  usdBalance = computed(() => {
    const kasBalance = this.kasBalance();
    const kaspaPrice = this.kaspaPriceService.price();

    if (kasBalance === 0 || kaspaPrice === 0) {
      return 0;
    }

    const usdValue = kasBalance * kaspaPrice;
    // Round to max 3 decimals
    return Math.round(usdValue * 1000) / 1000;
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
