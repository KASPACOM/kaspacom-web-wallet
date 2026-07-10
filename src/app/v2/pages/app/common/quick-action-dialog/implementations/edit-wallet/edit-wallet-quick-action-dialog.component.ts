import {
  Component,
  computed,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  input,
  output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { KcInputComponent } from 'kaspacom-ui';
import { KcButtonComponent } from '@kaspacom/ui-kit';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { MessagePopupService } from '../../../../../../../services/message-popup.service';

@Component({
  selector: 'app-edit-wallet-quick-action-dialog',
  standalone: true,
  imports: [
    FormsModule,
    KcInputComponent,
    KcButtonComponent,
    QuickActionDialogComponent,
  ],
  templateUrl: './edit-wallet-quick-action-dialog.component.html',
  styleUrl: './edit-wallet-quick-action-dialog.component.scss',
})
export class EditWalletQuickActionDialogComponent implements AfterViewInit {
  readonly isOpen = input(false);
  readonly data = input<any>(null);
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  private walletService = inject(WalletService);
  private messagePopupService = inject(MessagePopupService);
  private cdr = inject(ChangeDetectorRef);

  // Form data
  walletName = '';

  // Internal state for animation
  isDialogOpen = false;

  dialogTitle = computed(() => {
    return this.data()?.isEditMode ? 'Edit wallet name' : 'Wallet Details';
  });

  buttonText = computed(() => {
    return this.data()?.isEditMode ? 'Save' : 'OK';
  });

  ngAfterViewInit(): void {
    // Pre-fill wallet name in edit mode
    const data = this.data();
    if (data?.walletName) {
      this.walletName = data.walletName;
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

  async onSaveWallet(): Promise<void> {
    if (!this.walletName.trim()) {
      return;
    }

    try {
      const data = this.data();
      if (data?.isEditMode && data?.wallet) {
        // Update wallet name
        const wallet = data.wallet;
        const success = await this.walletService.updateWalletName(
          wallet,
          this.walletName.trim(),
        );

        if (success) {
          // The updateWalletName method already updates the current wallet signal
          // No need to call loadWallets() - state is already updated
          this.messagePopupService.showSuccess(
            `Wallet renamed to "${this.walletName}"`,
          );

          // Call the success callback to refresh the parent component
          if (data?.onSuccess) {
            data.onSuccess();
          }
        } else {
          this.messagePopupService.showError('Failed to update wallet name');
        }
      }

      // Reset form
      this.walletName = '';

      // Close dialog
      this.closeDialog();
    } catch (error) {
      console.error('Error updating wallet name:', error);
      this.messagePopupService.showError('Failed to update wallet name');
    }
  }
}
