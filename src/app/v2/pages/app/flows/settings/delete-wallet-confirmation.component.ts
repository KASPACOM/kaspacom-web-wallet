import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { FlowPageId } from '../../common/flow-page/flow-page.registry';
import { PasswordManagerService } from '../../../../../services/password-manager.service';
import { WalletService } from '../../../../../services/wallet.service';

@Component({
  selector: 'app-delete-wallet-confirmation',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './delete-wallet-confirmation.component.html',
  styleUrl: './delete-wallet-confirmation.component.scss',
})
export class DeleteWalletConfirmationComponent extends FlowPageBaseComponent {
  private passwordManagerService = inject(PasswordManagerService);
  private walletService = inject(WalletService);
  private router = inject(Router);

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
    this.flowPagesService.navigateBack();
  }

  async onDeleteWallet(): Promise<void> {
    try {
      // Clear all wallet data
      await this.passwordManagerService.clearAllData();
      
      // Deselect current wallet from memory
      await this.walletService.deselectCurrentWallet();
      
      // Close all flow pages
      this.flowPagesService.closePage();
      
      // Navigate to the main route for login/create
      this.router.navigate(['/wallet']);
      
      // Force page reload to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error during wallet deletion:', error);
      // Still try to navigate away even if there's an error
      this.router.navigate(['/wallet']);
      window.location.reload();
    }
  }
}
