import { Component, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { KcInputComponent, KcButtonComponent, KcIconComponent } from '@kaspacom/ui-kit';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { FlowPageId } from '../../common/flow-page/flow-page.registry';
import { PasswordManagerService } from '../../../../../services/password-manager.service';
import { WalletService } from '../../../../../services/wallet.service';
import {
  DELETE_ALL_WALLET_CONFIRMATION_PHRASE,
  isDeleteWalletConfirmationValid,
} from '../../../../shared/constants/delete-wallet.constants';

@Component({
  selector: 'app-delete-wallet-confirmation',
  standalone: true,
  imports: [FormsModule, KcButtonComponent, KcIconComponent, KcInputComponent],
  templateUrl: './delete-wallet-confirmation.component.html',
  styleUrl: './delete-wallet-confirmation.component.scss',
})
export class DeleteWalletConfirmationComponent extends FlowPageBaseComponent {
  private passwordManagerService = inject(PasswordManagerService);
  private walletService = inject(WalletService);
  private router = inject(Router);

  deleteConfirmationInput = signal('');
  readonly deleteConfirmationPhrase = DELETE_ALL_WALLET_CONFIRMATION_PHRASE;
  readonly isDeleteConfirmationValid = computed(() =>
    isDeleteWalletConfirmationValid(this.deleteConfirmationInput()),
  );

  get config(): IFlowPageConfig {
    return {
      id: 'delete-wallet-confirmation' as FlowPageId,
      title: 'Delete Wallet',
      canNavigateBack: true,
      canClose: true,
      showTitle: true,
      showBackground: true,
    };
  }

  onCancel(): void {
    this.deleteConfirmationInput.set('');
    this.flowPagesService.navigateBack();
  }

  async onDeleteWallet(): Promise<void> {
    if (!this.isDeleteConfirmationValid()) {
      return;
    }

    try {
      // Clear all wallet data
      await this.passwordManagerService.clearAllData();

      // Deselect current wallet from memory
      await this.walletService.deselectCurrentWallet();

      // Close all flow pages
      this.flowPagesService.closePage();

      // Force page reload to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error during wallet deletion:', error);
      window.location.reload();
    }
  }

  onDeleteConfirmationChange(value: string): void {
    this.deleteConfirmationInput.set(value ?? '');
  }
}
