import { Component, signal, OnInit, inject, computed } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { BalanceComponent } from './balance/balance.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';
import { L1AssetsContainerComponent } from './assets-container/l1-assets-container.component';
import { L2AssetsContainerComponent } from './assets-container/l2-assets-container.component';
import { PendingTransactionsBannerComponent } from './pending-transactions-banner/pending-transactions-banner.component';
import { WalletService } from '../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-home',
  imports: [
    BalanceComponent,
    CryptoActionsComponent,
    L1AssetsContainerComponent,
    L2AssetsContainerComponent,
    PendingTransactionsBannerComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private walletService = inject(WalletService);

  kasBalance = computed<number | null>(() => {
    if (this.walletService.isL2Display()) {
      return (
        this.walletService.getCurrentWallet()?.getL2WalletStateSignal()()
          ?.balanceFormatted || 0
      );
    } else {
      return (
        this.walletService.getCurrentWallet()?.getTotalBalanceAsSignal() || 0
      );
    }
  });

  isL2Display = computed(() => this.walletService.getIsL2DisplaySignal()());

  ngOnInit() {}
}
