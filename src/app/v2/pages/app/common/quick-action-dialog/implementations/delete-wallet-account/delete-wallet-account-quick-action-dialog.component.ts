import {
  Component,
  inject,
  ChangeDetectorRef,
  AfterViewInit,
  computed,
  input,
  output,
} from '@angular/core';

import { KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../classes/AppWallet';
import _ from 'lodash';

interface DeleteAccountDialogData {
  accountName: string;
  wallet: AppWallet;
  onSuccess?: () => void;
}

@Component({
  selector: 'app-delete-wallet-account-quick-action-dialog',
  standalone: true,
  imports: [KcButtonComponent, QuickActionDialogComponent],
  templateUrl: './delete-wallet-account-quick-action-dialog.component.html',
  styleUrl: './delete-wallet-account-quick-action-dialog.component.scss',
})
export class DeleteWalletAccountQuickActionDialogComponent implements AfterViewInit {
  readonly isOpen = input(false);
  readonly data = input<DeleteAccountDialogData>();
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  private notificationService = inject(NotificationService);
  private walletService = inject(WalletService);
  private cdr = inject(ChangeDetectorRef);

  // Internal state for animation
  isDialogOpen = false;

  isLastWalletAccount = computed(() => {
    if (!this.walletService.getAllWallets()) {
      return true;
    }

    const data = this.data();
    if (!data) {
      return true;
    }

    const allWalletsByWalletId = _.groupBy(
      this.walletService.getAllWallets()()!,
      'id',
    );

    return allWalletsByWalletId[data?.wallet.getId()].length <= 1;
  });

  ngAfterViewInit(): void {
    // Start with dialog closed, then open it to trigger animation
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  get accountName(): string {
    return this.data()?.accountName || '';
  }

  onBackdropClick(): void {
    this.closeDialog();
  }

  onClose(): void {
    this.closeDialog();
  }

  onCancel(): void {
    this.closeDialog();
  }

  private closeDialog(): void {
    this.isDialogOpen = false;
    // Wait for animation to complete before emitting close
    setTimeout(() => {
      this.close.emit();
    }, 300);
  }

  async onDelete(): Promise<void> {
    try {
      const data = this.data();
      const wallet: AppWallet | undefined = data?.wallet;
      if (!wallet) {
        this.notificationService.error('Error', 'No account selected');
        return;
      }

      const result = await this.walletService.removeWalletAccount(
        wallet.getIdWithAccount(),
      );

      if (result.success) {
        this.notificationService.success(
          'Success',
          `Account "${this.accountName}" deleted successfully!`,
        );
        // Call the success callback to refresh the parent component
        if (data?.onSuccess) {
          data.onSuccess();
        }

        this.closeDialog();
      } else {
        this.notificationService.error(
          'Error',
          result.error || 'Failed to delete account',
        );
        this.closeDialog();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      this.notificationService.error(
        'Error',
        'An error occurred while deleting the account',
      );
      this.closeDialog();
    }
  }
}
