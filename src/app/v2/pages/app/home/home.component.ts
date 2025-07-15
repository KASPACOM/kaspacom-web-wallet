import { Component, signal } from '@angular/core';
import { BalanceComponent } from './balance/balance.component';
import { WalletSummaryComponent } from './wallet-summary/wallet-summary.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';
import { KcLabeledTabsComponent, TabItem } from '../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { Krc721SummaryComponent } from './krc721-summary/krc721-summary.component';
import { KnsSummaryComponent } from './kns-summary/kns-summary.component';

@Component({
  selector: 'app-home',
  imports: [
    BalanceComponent, 
    WalletSummaryComponent, 
    CryptoActionsComponent,
    KcLabeledTabsComponent,
    Krc721SummaryComponent,
    KnsSummaryComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  selectedTabId = signal<string>('krc20');

  tabs: TabItem[] = [
    { id: 'krc20', label: 'KRC20' },
    { id: 'krc721', label: 'KRC721' },
    { id: 'kns', label: 'KNS' }
  ];

  onTabChange(tabId: string) {
    this.selectedTabId.set(tabId);
  }
}
