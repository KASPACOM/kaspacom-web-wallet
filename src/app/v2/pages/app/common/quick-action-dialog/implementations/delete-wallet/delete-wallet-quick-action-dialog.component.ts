import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from 'kaspacom-ui';
import { KcButtonComponent } from '@kaspacom/ui-kit';
import _ from 'lodash';
import { AppWallet } from '../../../../../../../classes/AppWallet';
import { WalletService } from '../../../../../../../services/wallet.service';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';

interface DeleteWalletDialogData {
  walletName: string;
  wallet: AppWallet;
  onSuccess?: () => void;
}

@Component({
  selector: 'app-delete-wallet-quick-action-dialog',
  standalone: true,
  imports: [FormsModule, KcButtonComponent, QuickActionDialogComponent],
  templateUrl: './delete-wallet-quick-action-dialog.component.html',
  styleUrl: './delete-wallet-quick-action-dialog.component.scss',
})
export class DeleteWalletQuickActionDialogComponent implements AfterViewInit {
  readonly isOpen = input(false);
  readonly data = input<DeleteWalletDialogData>();
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  private cdr = inject(ChangeDetectorRef);
  private walletService = inject(WalletService);
  private notificationService = inject(NotificationService);

  isDialogOpen = false;

  isLastWallet = computed(() => {
    if (!this.walletService.getAllWallets()) {
      return true;
    }

    const allWalletsByWalletId = _.keyBy(
      this.walletService.getAllWallets()()!,
      'id',
    );

    return Object.values(allWalletsByWalletId).length < 2;
  });

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  get walletName(): string {
    return this.data()?.walletName || '';
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
    setTimeout(() => {
      this.close.emit();
    }, 300);
  }

  async onDelete(): Promise<void> {
    const data = this.data();
    const wallet = data?.wallet;
    if (!wallet) {
      this.notificationService.error('Error', 'No wallet selected');
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
      if (data?.onSuccess) {
        data.onSuccess();
      }
      this.closeDialog();
    } else {
      this.notificationService.error('Error', 'Failed to delete wallet');
      this.closeDialog();
    }
  }
}
