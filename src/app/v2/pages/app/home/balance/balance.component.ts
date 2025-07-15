import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-balance',
  imports: [DecimalPipe, CommaFormatterPipe, KcIconComponent, SkeletonComponent],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss',
})
export class BalanceComponent {
  private walletService = inject(WalletService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);

  usdBalance = computed(() => 13.45);
  
  // Check if wallet data is loading
  isLoading = computed(() => {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      return true;
    }
    
    const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
    return !balanceData;
  });
  
  // Get the actual KAS balance from the wallet
  kasBalance = computed(() => {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      return 0;
    }
    
    const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
    if (!balanceData?.mature) {
      return 0;
    }
    
    return this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature);
  });

}
