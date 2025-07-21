import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { AssetsStoreService } from '../../../../../services/assets-store.service';

@Component({
  selector: 'app-balance',
  imports: [DecimalPipe, CommaFormatterPipe, KcIconComponent, SkeletonComponent],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss',
})
export class BalanceComponent {
  private walletService = inject(WalletService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private assetsStore = inject(AssetsStoreService);

  usdBalance = computed(() => 13.45);
  
  // Check if wallet data is loading
  isLoading = computed(() => {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      return true;
    }
    
    // Check if kaspa assets are loading
    return this.assetsStore.isAssetTypeLoading('kaspa');
  });
  
  // Get the actual KAS balance from the assets store
  kasBalance = computed(() => {
    const kaspaAssets = this.assetsStore.kaspaAssets();
    if (!kaspaAssets) {
      return 0;
    }
    
    return this.kaspaNetworkActionsService.sompiToNumber(kaspaAssets.totalBalance);
  });

}
