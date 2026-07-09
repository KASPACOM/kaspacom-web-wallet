import { Component, computed, inject } from '@angular/core';

import { FlowPageBaseComponent } from '../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../common/flow-page/interfaces/flow-page.interface';
import { L1SendAssetsContainerComponent } from './l1-send-assets-container.component';
import { L2SendAssetsContainerComponent } from './l2-send-assets-container.component';
import { WalletService } from '../../../../../../services/wallet.service';

@Component({
  selector: 'app-send-page',
  standalone: true,
  imports: [
    L1SendAssetsContainerComponent,
    L2SendAssetsContainerComponent
],
  templateUrl: './send-page.component.html',
  styleUrl: './send-page.component.scss',
})
export class SendPageComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);

  isL2Network = computed(() => this.walletService.getIsL2DisplaySignal()());

  get config(): IFlowPageConfig {
    return {
      id: 'send',
      title: `Send`,
      canNavigateBack: true,
    };
  }

  // L1 asset card clicks
  onKaspaCardClick(): void {
    this.navigateToNextPage({
      id: 'send-kaspa',
      title: 'Send Kaspa',
      canNavigateBack: true,
    });
  }

  onKrc20CardClick(): void {
    this.navigateToNextPage({
      id: 'send-krc20-list',
      title: 'Select KRC20 Token',
      canNavigateBack: true,
    });
  }

  onNftCardClick(): void {
    this.navigateToNextPage({
      id: 'send-nft-list',
      title: 'Select NFT',
      canNavigateBack: true,
    });
  }

  onKnsCardClick(): void {
    this.navigateToNextPage({
      id: 'send-kns-list',
      title: 'Select KNS Domain',
      canNavigateBack: true,
    });
  }

  // L2 asset card clicks
  onL2KaspaCardClick(): void {
    this.navigateToNextPage({
      id: 'send-l2-kaspa',
      title: 'Send Kaspa (L2)',
      canNavigateBack: true,
    });
  }

  onL2Erc20CardClick(): void {
    this.navigateToNextPage({
      id: 'send-l2-erc20-list',
      title: 'Select ERC20 Token',
      canNavigateBack: true,
    });
  }
}
