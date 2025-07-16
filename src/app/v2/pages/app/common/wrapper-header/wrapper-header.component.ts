import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent, KcButtonComponent } from 'kaspacom-ui';
import { SearchBarComponent } from '../../home/search/search-bar/search-bar.component';
import { WalletService } from '../../../../../services/wallet.service';
import { UtilsHelper } from '../../../../../services/utils.service';
import { AccountSettingsService } from '../services/account-settings.service';

@Component({
  selector: 'app-wrapper-header',
  imports: [KcIconComponent, KcButtonComponent, RouterModule, SearchBarComponent],
  templateUrl: './wrapper-header.component.html',
  styleUrl: './wrapper-header.component.scss',
})
export class WrapperHeaderComponent {
  router = inject(Router);
  walletService = inject(WalletService);
  utilsHelper = inject(UtilsHelper);
  accountSettingsService = inject(AccountSettingsService);

  // Use signals for reactive updates
  currentWallet = this.walletService.getCurrentWalletSignal();
  
  accountName = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getDisplayName() || 'Account 1';
  });

  walletAddress = computed(() => {
    const wallet = this.currentWallet();
    if (!wallet) {
      console.log('No wallet found in currentWallet signal');
      return '';
    }
    try {
      const address = wallet.getAddress();
      console.log('Wallet address:', address);
      return address;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      return '';
    }
  });

  shortenedAddress = computed(() => {
    const address = this.walletAddress();
    return address ? this.utilsHelper.shortenAddress(address) : '';
  });

  chevronIconClass = computed(() => {
    return this.accountSettingsService.isOpen ? 'icon-chevron-up' : 'icon-chevron-down';
  });

  onSettingsClick(): void {
    // Navigate to settings page or implement settings logic
    console.log('Settings clicked');
  }

  onCopyAddress(): void {
    const address = this.walletAddress();
    if (address) {
      navigator.clipboard.writeText(address);
      // You might want to show a toast notification here
    }
  }

  toggleAccountSettings(): void {
    this.accountSettingsService.toggle();
  }
}
