import { Component } from '@angular/core';
import {
  KcLabeledTabsComponent,
  TabItem,
} from '../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { WalletSummaryComponent } from '../wallet-summary/wallet-summary.component';
import { Krc721SummaryComponent } from '../krc721-summary/krc721-summary.component';
import { KnsSummaryComponent } from '../kns-summary/kns-summary.component';
import { UtxosSummaryComponent } from '../utxos-summary/utxos-summary.component';
import { BaseAssetsContainerComponent } from './base-assets-container';

@Component({
  selector: 'app-l1-assets-container',
  standalone: true,
  imports: [
    KcLabeledTabsComponent,
    WalletSummaryComponent,
    Krc721SummaryComponent,
    KnsSummaryComponent,
    UtxosSummaryComponent,
  ],
  templateUrl: './l1-assets-container.component.html',
  styleUrl: './l1-assets-container.component.scss',
})
export class L1AssetsContainerComponent extends BaseAssetsContainerComponent {
  tabs: TabItem[] = [
    { id: 'utxos', label: 'UTXOs' },
    { id: 'krc20', label: 'KRC20' },
    { id: 'krc721', label: 'KRC721' },
    { id: 'kns', label: 'KNS' },
  ];
}
