import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
  AfterViewInit,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  NotificationService,
} from 'kaspacom-ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { AppWallet } from '../../../../../../../classes/AppWallet';
import { WalletService } from '../../../../../../../services/wallet.service';
import _ from 'lodash';

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

  isLastWallet = computed(() => {
    if (!this.walletService.getAllWallets()) {
      return true;
    }

    const allWalletsByWalletId = _.keyBy(this.walletService.getAllWallets()()!, 'id');

    return Object.values(allWalletsByWalletId).length < 2;
  })

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  get walletName(): string {
    return this.data?.walletName || '';
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
    const wallet = this.data?.wallet;
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
