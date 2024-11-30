import { Component, OnInit, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { WalletWithBalanceInfo } from '../../types/wallet-with-balance-info';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from '../../services/kaspa-netwrok-services/kaspa-network-transactions-manager.service';

@Component({
  selector: 'wallet-selection',
  standalone: true,
  templateUrl: './wallet-selection.component.html',
  styleUrls: ['./wallet-selection.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor],
})
export class WalletSelectionComponent implements OnInit {
  public Object = Object;
  walletsByAddress?: WritableSignal<{
    [walletsAdress: string]: WalletWithBalanceInfo;
  }>; // List of wallets
  user: any = {}; // User information

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router,
    // private kaspaTransactionsManagerService: KaspaNetworkTransactionsManagerService
  ) {}

  ngOnInit(): void {
    // Fetch user and wallet data here
    this.loadUserData();
    this.loadWallets();

    // console.log('asdasdads', this.kaspaTransactionsManagerService.getConnectionStatusSignal()());
  }

  loadUserData() {
    // Assume you have a service or local storage for user data
    this.user = { username: 'JohnDoe', email: 'johndoe@example.com' };
  }

  async loadWallets() {
    const result = await this.walletService.getAllWalletsWithBalancesAsSignal();
    // Get wallets from the wallet service (API or local storage)
    // result.subscribe(
    //   (wallets) => {
    //     console.log('Wallets:', wallets);
    //     this.wallets = wallets;
    //   },
    //   (error) => {
    //     console.error('Error fetching wallets', error);
    //   }
    // );

    this.walletsByAddress = result;
  }

  goToWallet(walletId: number) {
    // Navigate to wallet details or send funds page for a specific wallet
    this.router.navigate([`/wallet/${walletId}`]);
  }

  addWallet() {
    // Navigate to the wallet import page
    this.router.navigate(['/add-wallet']);
  }
}
