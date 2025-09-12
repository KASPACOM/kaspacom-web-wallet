import { Component, signal, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BalanceComponent } from './balance/balance.component';
import { WalletSummaryComponent } from './wallet-summary/wallet-summary.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';
import { KcLabeledTabsComponent, TabItem } from '../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { Krc721SummaryComponent } from './krc721-summary/krc721-summary.component';
import { KnsSummaryComponent } from './kns-summary/kns-summary.component';
import { UtxosSummaryComponent } from './utxos-summary/utxos-summary.component';

@Component({
  selector: 'app-home',
  imports: [
    BalanceComponent, 
    WalletSummaryComponent, 
    CryptoActionsComponent,
    KcLabeledTabsComponent,
    Krc721SummaryComponent,
    KnsSummaryComponent,
    UtxosSummaryComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  selectedTabId = signal<string>('utxos');

  tabs: TabItem[] = [
    { id: 'utxos', label: 'UTXOs' },
    { id: 'krc20', label: 'KRC20' },
    { id: 'krc721', label: 'KRC721' },
    { id: 'kns', label: 'KNS' }
  ];

  ngOnInit() {
    // Check for tab parameter in query params
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'];
      if (tabParam && this.isValidTab(tabParam)) {
        this.selectedTabId.set(tabParam);
      }
    });
  }

  onTabChange(tabId: string) {
    this.selectedTabId.set(tabId);
    // Update URL with current tab (without navigating)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabId },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private isValidTab(tabId: string): boolean {
    return this.tabs.some(tab => tab.id === tabId);
  }
}
