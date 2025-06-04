import { Component } from '@angular/core';
import { BalanceComponent } from './balance/balance.component';
import { WalletSummaryComponent } from './wallet-summary/wallet-summary.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';

@Component({
  selector: 'app-home',
  imports: [BalanceComponent, WalletSummaryComponent, CryptoActionsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {}
