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
import { FormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  KcInputComponent,
  NotificationService,
} from 'kaspacom-ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { AppWallet } from '../../../../../../../classes/AppWallet';
import { WalletService } from '../../../../../../../services/wallet.service';
import {
  DELETE_WALLET_CONFIRMATION_PHRASE,
  isDeleteWalletConfirmationValid,
} from '../../../../../../shared/constants/delete-wallet.constants';

interface DeleteWalletDialogData {
  walletName: string;
  wallet: AppWallet;
  onSuccess?: () => void;
}

@Component({
  selector: 'app-delete-wallet-quick-action-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    QuickActionDialogComponent,
  ],
  templateUrl: './delete-wallet-quick-action-dialog.component.html',
  styleUrl: './delete-wallet-quick-action-dialog.component.scss',
})
export class DeleteWalletQuickActionDialogComponent implements AfterViewInit {
  @Input() isOpen = false;
  @Input() data: DeleteWalletDialogData | undefined;
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  private cdr = inject(ChangeDetectorRef);
  private walletService = inject(WalletService);
  private notificationService = inject(NotificationService);

  isDialogOpen = false;
  confirmationInput = '';
  readonly deleteConfirmationPhrase = DELETE_WALLET_CONFIRMATION_PHRASE;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  get walletName(): string {
    return this.data?.walletName || '';
  }

  get canDelete(): boolean {
    return isDeleteWalletConfirmationValid(this.confirmationInput);
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

  onConfirmationChange(value: string): void {
    this.confirmationInput = value ?? '';
  }

  private closeDialog(): void {
    this.isDialogOpen = false;
    this.confirmationInput = '';
    setTimeout(() => {
      this.close.emit();
    }, 300);
  }

  async onDelete(): Promise<void> {
    const wallet = this.data?.wallet;
    if (!wallet) {
      this.notificationService.error('Error', 'No wallet selected');
      return;
    }

    if (!this.canDelete) {
      this.notificationService.error(
        'Confirmation required',
        `Type "${this.deleteConfirmationPhrase}" to confirm deletion`,
      );
      return;
    }

    const deleted = await this.walletService.deleteWallet(
      wallet.getIdWithAccount(),
    );
    if (deleted) {
      this.notificationService.success(
        'Success',
        `Wallet "${this.walletName}" deleted successfully!`,
      );
      if (this.data?.onSuccess) {
        this.data.onSuccess();
      }
      this.closeDialog();
    } else {
      this.notificationService.error('Error', 'Failed to delete wallet');
      this.closeDialog();
    }
  }
}
