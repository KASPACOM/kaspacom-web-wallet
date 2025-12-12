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
import { KcButtonComponent, NotificationService } from 'kaspacom-ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../classes/AppWallet';

interface DeleteAccountDialogData {
  accountName: string;
  wallet: AppWallet;
  onSuccess?: () => void;
}

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
  @Input() data: DeleteAccountDialogData | undefined;
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  private notificationService = inject(NotificationService);
  private walletService = inject(WalletService);
  private cdr = inject(ChangeDetectorRef);

  // Internal state for animation
  isDialogOpen = false;

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
      const wallet: AppWallet | undefined = this.data?.wallet;
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
        if (this.data?.onSuccess) {
          this.data.onSuccess();
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
