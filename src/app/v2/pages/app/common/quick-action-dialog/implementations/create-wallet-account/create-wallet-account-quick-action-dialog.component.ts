import {
  Component,
  inject,
  ChangeDetectorRef,
  AfterViewInit,
  input,
  output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { KcInputComponent, KcButtonComponent, NotificationService } from 'kaspacom-ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../classes/AppWallet';

@Component({
  selector: 'app-create-wallet-account-quick-action-dialog',
  standalone: true,
  imports: [
    FormsModule,
    KcInputComponent,
    KcButtonComponent,
    QuickActionDialogComponent,
  ],
  templateUrl: './create-wallet-account-quick-action-dialog.component.html',
  styleUrl: './create-wallet-account-quick-action-dialog.component.scss',
})
export class CreateWalletAccountQuickActionDialogComponent implements AfterViewInit {
  readonly isOpen = input(false);
  readonly data = input<any>();
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  private notificationService = inject(NotificationService);
  private walletService = inject(WalletService);
  private cdr = inject(ChangeDetectorRef);

  // Form data
  accountName = '';

  // Internal state for animation
  isDialogOpen = false;

  get isEditMode(): boolean {
    return this.data()?.isEditMode || false;
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Edit account' : 'Add account';
  }

  get buttonText(): string {
    return this.isEditMode ? 'Save' : 'Create';
  }

  ngAfterViewInit(): void {
    // Pre-fill account name in edit mode
    const data = this.data();
    if (this.isEditMode && data?.accountName) {
      this.accountName = data.accountName;
    }

    // Start with dialog closed, then open it to trigger animation
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  onBackdropClick(): void {
    this.closeDialog();
  }

  onClose(): void {
    this.closeDialog();
  }

  private closeDialog(): void {
    this.isDialogOpen = false;
    // Wait for animation to complete before emitting close
    setTimeout(() => {
      this.close.emit();
    }, 300);
  }

  async onCreateAccount(): Promise<void> {
    if (this.accountName.trim()) {
      try {
        if (this.isEditMode) {
          // Handle account name update
          const wallet: AppWallet = this.data().wallet;

          // For accounts, we need to update the account name, not the wallet name
          if (wallet.getDerivedPath()) {
            // This is an account, update account name
            const success = await this.walletService.updateWalletAccountName(
              wallet,
              this.accountName,
            );
            if (success) {
              this.notificationService.success(
                'Success',
                `Account name updated successfully!`,
              );
              // Account name is already updated in storage, no need to reload
              // Call the success callback to refresh the parent component
              const data = this.data();
              if (data?.onSuccess) {
                data.onSuccess();
              }
            } else {
              this.notificationService.error(
                'Error',
                'Failed to update account name',
              );
            }
          } else {
            // This is a wallet without accounts, update wallet name
            const success = await this.walletService.updateWalletName(
              wallet,
              this.accountName,
            );
            if (success) {
              this.notificationService.success(
                'Success',
                `Wallet name updated successfully!`,
              );
              // The updateWalletName method already updates the wallet signal
              // Call the success callback to refresh the parent component
              const data = this.data();
              if (data?.onSuccess) {
                data.onSuccess();
              }
            } else {
              this.notificationService.error(
                'Error',
                'Failed to update wallet name',
              );
            }
          }
        } else {
          // Handle account creation
          const currentWallet = this.walletService.getCurrentWallet();
          if (!currentWallet) {
            this.notificationService.error('Error', 'No wallet selected');
            return;
          }

          // Get all wallets for this wallet ID
          const allWallets = this.walletService.getAllWallets(false)() || [];
          const walletGroup = allWallets.filter(
            (w) => w.getId() === currentWallet.getId(),
          );

          if (walletGroup.length === 0) {
            this.notificationService.error('Error', 'Wallet not found');
            return;
          }

          // Calculate next account number
          const accounts = walletGroup.map((wallet) =>
            this.walletService.getWalletAccountNumberFromDerivedPath(
              wallet.getDerivedPath()!,
            ),
          );
          const maxAccount = Math.max(...accounts);
          const newAccountNumber = maxAccount + 1;

          // Add the new account
          const result = await this.walletService.addWalletAccount(
            walletGroup[0].getId(),
            this.walletService.replaceWalletAccountNumberFromDerivedPath(
              walletGroup[0].getDerivedPath()!,
              newAccountNumber,
            ),
            this.accountName,
          );

          if (result.success) {
            // Show success notification
            this.notificationService.success(
              'Success',
              `Account "${this.accountName}" added successfully!`,
            );
            // Note: addWalletAccount already updates the wallet service's signal,
            // so we don't need to call loadWallets() here
            // Call the success callback to refresh the parent component
            const data = this.data();
            if (data?.onSuccess) {
              data.onSuccess();
            }
          } else {
            this.notificationService.error(
              'Error',
              result.error || 'Failed to add account',
            );
          }
        }

        // Reset form
        this.accountName = '';

        // Close dialog
        this.closeDialog();
      } catch (error) {
        console.error('Error:', error);
        this.notificationService.error('Error', 'An error occurred');
      }
    }
  }
}
