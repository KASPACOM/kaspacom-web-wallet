import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BalanceComponent } from './balance/balance.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';
import { L1AssetsContainerComponent } from './assets-container/l1-assets-container.component';
import { WalletService } from '../../../../services/wallet.service';

@Component({
  selector: 'app-home',
  imports: [
    BalanceComponent,
    CryptoActionsComponent,
    L1AssetsContainerComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private walletService = inject(WalletService);

  l2KasBalance = computed<number | null>(() => {
    const wallet = this.walletService.getCurrentWallet();
    const l2State = wallet?.getL2WalletStateSignal()();
    if (!wallet || !l2State) {
      return null;
    }
    return l2State.balanceFormatted;
  });

  ngOnInit() {}
}
