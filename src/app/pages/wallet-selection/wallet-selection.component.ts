import { Component, OnInit, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';
import { ExportWalletsQrComponent } from '../../components/wallet-management/export-wallets-qr/export-wallets-qr.component';
import _ from 'lodash';

@Component({
  selector: 'wallet-selection',
  standalone: true,
  templateUrl: './wallet-selection.component.html',
  styleUrls: ['./wallet-selection.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor, ExportWalletsQrComponent],
})
export class WalletSelectionComponent implements OnInit {
  public Object = Object;
  walletGroups: AppWallet[][] | undefined = undefined;
  user: any = {}; // User information

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router // private kaspaTransactionsManagerService: KaspaNetworkTransactionsManagerService
  ) { }

  ngOnInit(): void {
    this.loadWallets();
  }

  async loadWallets() {
    const result = await this.walletService.getAllWallets(true)();

    const groupedWallets = _.groupBy(result, (wallet) => wallet.getId());

    this.walletGroups = this.Object.values(groupedWallets);
  }

  async selectWallet(wallet: AppWallet) {
    await this.walletService.selectCurrentWallet(wallet.getIdWithAccount());
    // Navigate to wallet details or send funds page for a specific wallet
    this.router.navigate([`/wallet-info`]);
  }

  async deleteWallet(wallet: AppWallet) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete wallet ${wallet.getName()} (${wallet.getAddress()})?`
    );
    if (confirmDelete) {
      this.walletService.deleteWallet(wallet.getIdWithAccount()).then(() => {
        // Reload the list of wallets
        this.loadWallets();
      });
    }
  }

  addWallet() {
    // Navigate to the wallet import page
    this.router.navigate(['/add-wallet']);
  }

  async updateWalletName(wallet: AppWallet) {
    await this.walletService.updateWalletName(wallet, wallet.getName());
    // Reload the list of wallets
    await this.loadWallets();
  }

  onNameInput(event: Event, wallet: AppWallet): void {
    const inputElement = event.target as HTMLInputElement;
    wallet.setName(inputElement.value);
  }

  async addAccount(walletGroup: AppWallet[]) {
    const accounts = walletGroup.map((wallet) => this.walletService.getWalletAccountNumberFromDerivedPath(wallet.getDerivedPath()!));
    const maxAccount = Math.max(...accounts);

    const newAccountNumber = maxAccount + 1;

    await this.walletService.addWalletAccount(walletGroup[0].getId(), this.walletService.replaceWalletAccountNumberFromDerivedPath(walletGroup[0].getDerivedPath()!, newAccountNumber), '#' + newAccountNumber.toString());
    await this.loadWallets();
  }

  async removeAccount(wallet: AppWallet) {
    await this.walletService.removeWalletAccount(wallet.getIdWithAccount());
    await this.loadWallets();
  }
}
