import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { FlowPageId } from '../../common/flow-page/flow-page.registry';
import { WalletService } from '../../../../../services/wallet.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './settings-menu.component.html',
  styleUrl: './settings-menu.component.scss',
})
export class SettingsMenuComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private router = inject(Router);

  get config(): IFlowPageConfig {
    return {
      id: 'settings-menu' as FlowPageId,
      title: 'Settings',
      canNavigateBack: true,
      canClose: true,
      showTitle: true,
      showBackground: true,
    };
  }

  onExportWallet(): void {
    this.flowPagesService.navigateToPage({
      id: 'export-kaspacom-wallet' as FlowPageId,
      title: 'Export Kaspacom Wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  onDeleteWallet(): void {
    this.flowPagesService.navigateToPage({
      id: 'delete-wallet-confirmation' as FlowPageId,
      title: 'Delete Wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  async onLogout(): Promise<void> {
    try {
      // Use centralized logout method from WalletService
      await this.walletService.logout();
      
      // Close all flow pages
      this.flowPagesService.closePage();
      
      // Navigate to the onboarding screen which now handles login
      this.router.navigate(['/onboarding']);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still try to navigate away even if there's an error
      this.router.navigate(['/onboarding']);
    }
  }
}
