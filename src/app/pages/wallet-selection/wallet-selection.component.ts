import { Component, OnInit, WritableSignal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppWallet } from '../../classes/AppWallet';
import { ExportWalletsQrComponent } from '../../components/wallet-management/export-wallets-qr/export-wallets-qr.component';
import _ from 'lodash';
import { ApprovalFlowService } from '../../v2/services/approval-flow.service';
import { WalletActionService } from '../../services/wallet-action.service';

@Component({
  selector: 'wallet-selection',
  templateUrl: './wallet-selection.component.html',
  styleUrls: ['./wallet-selection.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, ExportWalletsQrComponent],
})
export class WalletSelectionComponent implements OnInit {
  private walletService = inject(WalletService);
  private router = inject(Router);

  public Object = Object;
  walletGroups: AppWallet[][] | undefined = undefined;
  user: any = {}; // User information

  private approvalFlowService = inject(ApprovalFlowService);
  private walletActionService = inject(WalletActionService);

  ngOnInit(): void {
    this.loadWallets();
  }

  async loadWallets() {
    const result = this.walletService.getAllWallets(true)();

    const groupedWallets = _.groupBy(result, (wallet) => wallet.getId());

    this.walletGroups = this.Object.values(groupedWallets);
  }

  async selectWallet(wallet: AppWallet) {
    await this.walletService.selectCurrentWallet(wallet.getIdWithAccount());
    // Clean up any ongoing approval flow before navigating
    this.approvalFlowService.closeApproval();
    // Clear any pending action state from the old review-action component
    this.walletActionService.clearActionResult();
    // Navigate to wallet details or send funds page for a specific wallet
    this.router.navigate([`/wallet-info`]);
  }

  async deleteWallet(wallet: AppWallet) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete wallet ${wallet.getName()} (${wallet.getAddress()})?`,
    );
    if (confirmDelete) {
      this.walletService.deleteWallet(wallet.getIdWithAccount()).then(() => {
        // The deleteWallet method already updates the wallet signals
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
    // The updateWalletName method already updates wallet signals
    this.loadWallets();
  }

  onNameInput(event: Event, wallet: AppWallet): void {
    const inputElement = event.target as HTMLInputElement;
    wallet.setName(inputElement.value);
  }

  async addAccount(walletGroup: AppWallet[]) {
    const accounts = walletGroup.map((wallet) =>
      this.walletService.getWalletAccountNumberFromDerivedPath(
        wallet.getDerivedPath()!,
      ),
    );
    const maxAccount = Math.max(...accounts);

    const newAccountNumber = maxAccount + 1;

    await this.walletService.addWalletAccount(
      walletGroup[0].getId(),
      this.walletService.replaceWalletAccountNumberFromDerivedPath(
        walletGroup[0].getDerivedPath()!,
        newAccountNumber,
      ),
      '#' + newAccountNumber.toString(),
    );
    // The addWalletAccount method already updates wallet signals
    this.loadWallets();
  }

  async removeAccount(wallet: AppWallet) {
    await this.walletService.removeWalletAccount(wallet.getIdWithAccount());
    // The removeWalletAccount method already updates wallet signals
    this.loadWallets();
  }
}
