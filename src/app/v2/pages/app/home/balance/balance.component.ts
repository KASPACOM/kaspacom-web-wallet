import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { KcIconComponent } from '@kaspacom/ui';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { KaspaPriceService } from '../../../../../services/kaspa-price.service';

@Component({
  selector: 'app-balance',
  imports: [
    DecimalPipe,
    CommaFormatterPipe,
    KcIconComponent,
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
    const currentNetwork = 'l1-kaspa';

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

    // For L1 Kaspa, use mature balance
    if (currentNetwork === 'l1-kaspa') {
      return this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature);
    }

    // For L2 networks, check if there's L2 balance data
    if (currentNetwork === 'kasplex' || currentNetwork === 'igra') {
      const l2State = wallet.getL2WalletStateSignal()();
      if (l2State) {
        return l2State.balanceFormatted;
      }
      return 0;
    }

    return this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature);
  });
}
