import { Component, computed, inject } from '@angular/core';

import {
  KcLabeledTabsComponent,
  TabItem,
} from '../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import {
  BaseAssetsContainerComponent,
  ASSET_TAB_IDS,
} from './base-assets-container';
import { Erc20SummaryComponent } from '../assets-lists/l2/summary/erc20-summary/erc20-summary.component';
import { L2TxHistoryComponent } from '../assets-lists/l2/l2-tx-history/l2-tx-history.component';
import { KcButtonComponent } from 'kaspacom-ui';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';
import { L2_ASSET_KEYS } from '../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';

@Component({
  selector: 'app-l2-assets-container',
  standalone: true,
  imports: [KcLabeledTabsComponent, Erc20SummaryComponent, L2TxHistoryComponent, KcButtonComponent],
  templateUrl: './l2-assets-container.component.html',
  styleUrl: './l2-assets-container.component.scss',
})
export class L2AssetsContainerComponent extends BaseAssetsContainerComponent {
  private assetsManagerService = inject(AssetsManagerService);
  private flowPagesService = inject(FlowPagesService);

  tabs: TabItem[] = [
    { id: ASSET_TAB_IDS.L2_ERC20, label: 'ERC20' },
    { id: ASSET_TAB_IDS.L2_TX_HISTORY, label: 'History' },
  ];

  hasErc20Tokens = computed(() =>
    (this.assetsManagerService.getAllAssetStores().l2.getAssets(L2_ASSET_KEYS.erc20) ?? []).length > 0
  );

  showImportTokenFab = computed(() =>
    this.selectedTabId() === ASSET_TAB_IDS.L2_ERC20 && this.hasErc20Tokens()
  );

  onImportToken(): void {
    this.flowPagesService.openFlow({
      id: 'import-token',
      title: 'Import Token',
      canNavigateBack: true,
    });
  }
}
