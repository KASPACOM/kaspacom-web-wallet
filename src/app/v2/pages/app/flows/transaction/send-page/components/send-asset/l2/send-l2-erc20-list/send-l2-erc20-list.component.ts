import { Component, computed, inject } from '@angular/core';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L2_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { Erc20AssetCardComponent } from '../../../../../../../home/assets-lists/l2/asset-card/erc20-asset-card/erc20-asset-card.component';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton';
import { InfiniteScrollDirective } from '../../../../../../../../../../directives/infinite-scroll.directive';

@Component({
  selector: 'app-send-l2-erc20-list',
  standalone: true,
  imports: [Erc20AssetCardComponent, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './send-l2-erc20-list.component.html',
  styleUrl: './send-l2-erc20-list.component.scss',
})
export class SendL2Erc20ListComponent extends FlowPageBaseComponent {
  get config(): IFlowPageConfig {
    return {
      id: 'send-l2-erc20-list',
      title: 'Select ERC20 Token',
      canNavigateBack: true,
    };
  }

  private assetsManagerService = inject(AssetsManagerService);

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<Erc20Token[]>(() => {
    const erc20Assets: Erc20Token[] = this.assetsManagerService.getAllAssetStores().l2.getAssets(
      L2_ASSET_KEYS.erc20,
    );

    return erc20Assets;
  });

  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l2.getAssetSignal(L2_ASSET_KEYS.erc20)());

  onTokenClick(token: Erc20Token): void {
    // Navigate to the KRC20 asset detail page
    this.navigateToNextPage({
      id: 'send-erc20',
      title: `Send ${token.name}`,
      canNavigateBack: true,
      data: { token }
    });
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByToken(index: number, token: Erc20Token): string {
    return token.address;
  }
}
