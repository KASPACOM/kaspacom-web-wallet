import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-l2-assets-container',
  standalone: true,
  imports: [CommonModule, KcLabeledTabsComponent, Erc20SummaryComponent, L2TxHistoryComponent],
  templateUrl: './l2-assets-container.component.html',
  styleUrl: './l2-assets-container.component.scss',
})
export class L2AssetsContainerComponent extends BaseAssetsContainerComponent {
  tabs: TabItem[] = [
    { id: ASSET_TAB_IDS.L2_ERC20, label: 'ERC20' },
    { id: ASSET_TAB_IDS.L2_TX_HISTORY, label: 'History' },
  ];
}
