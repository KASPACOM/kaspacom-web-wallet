import { Component, OnInit, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';

@Component({
  selector: 'wallet-selection',
  standalone: true,
  templateUrl: './wallet-selection.component.html',
  styleUrls: ['./wallet-selection.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor],
})
export class WalletSelectionComponent implements OnInit {
  public Object = Object;
  wallets: AppWallet[] | undefined = undefined;
  user: any = {}; // User information

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router
  ) // private kaspaTransactionsManagerService: KaspaNetworkTransactionsManagerService
  {}

  ngOnInit(): void {
    this.loadWallets();
  }


  async loadWallets() {
    const result = await this.walletService.getAllWallets();

    this.wallets = result;
  }

  async selectWallet(wallet: AppWallet) {
    await this.walletService.selectCurrentWallet(wallet.getId());
    // Navigate to wallet details or send funds page for a specific wallet
    this.router.navigate([`/wallet-info`]);
  }

  async deleteWallet(wallet: AppWallet) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete wallet ${wallet.getName()} (${wallet.getAddress()})?`
    );
    if (confirmDelete) {
      this.walletService.deleteWallet(wallet.getId()).then(() => {
        // Reload the list of wallets
        this.loadWallets();
      });
    }
  }

  addWallet() {
    // Navigate to the wallet import page
    this.router.navigate(['/add-wallet']);
  }
}
