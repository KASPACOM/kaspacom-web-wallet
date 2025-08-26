import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, NotificationService } from '@kaspacom/ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../classes/AppWallet';

@Component({
  selector: 'app-delete-wallet-account-quick-action-dialog',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, QuickActionDialogComponent],
  templateUrl: './delete-wallet-account-quick-action-dialog.component.html',
  styleUrl: './delete-wallet-account-quick-action-dialog.component.scss',
})
export class DeleteWalletAccountQuickActionDialogComponent
  implements AfterViewInit
{
  @Input() isOpen = false;
  @Input() data: any;
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  private notificationService = inject(NotificationService);
  private walletService = inject(WalletService);
  private cdr = inject(ChangeDetectorRef);

  // Internal state for animation
  isDialogOpen = false;

  get isDeleteEntireWallet(): boolean {
    return this.data?.deleteEntireWallet === true;
  }

  ngAfterViewInit(): void {
    // Start with dialog closed, then open it to trigger animation
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  get accountName(): string {
    return this.data?.accountName || '';
  }

  get dialogTitle(): string {
    return this.isDeleteEntireWallet ? 'Delete wallet' : 'Delete account';
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
      const wallet: AppWallet = this.data?.wallet;
      if (!wallet) {
        this.notificationService.error('Error', 'No wallet selected');
        return;
      }
      let success = false;
      let error: string | undefined;
      if (this.isDeleteEntireWallet) {
        const deleted = await this.walletService.deleteWallet(
          wallet.getIdWithAccount(),
        );
        success = deleted;
        if (!deleted) {
          error = 'Failed to delete wallet';
        }
      } else {
        const result = await this.walletService.removeWalletAccount(
          wallet.getIdWithAccount(),
        );
        success = result.success;
        error = result.error;
      }
      if (success) {
        const msg = this.isDeleteEntireWallet
          ? `Wallet "${this.accountName}" deleted successfully!`
          : `Account "${this.accountName}" deleted successfully!`;
        this.notificationService.success('Success', msg);
        // Call the success callback to refresh the parent component
        if (this.data?.onSuccess) {
          this.data.onSuccess();
        }

        this.closeDialog();
      } else {
        const err =
          error ||
          (this.isDeleteEntireWallet
            ? 'Failed to delete wallet'
            : 'Failed to delete account');
        this.notificationService.error('Error', err);
        this.closeDialog();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      this.notificationService.error(
        'Error',
        this.isDeleteEntireWallet
          ? 'An error occurred while deleting the wallet'
          : 'An error occurred while deleting the account',
      );
      this.closeDialog();
    }
  }
}
