import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent, KcButtonComponent } from '@kaspacom/ui';
import { SearchBarComponent } from '../../home/search/search-bar/search-bar.component';
import { WalletService } from '../../../../../services/wallet.service';
import { UtilsHelper } from '../../../../../services/utils.service';
import { AccountSettingsService } from '../../../../services/account-settings.service';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { WalletProfileOrbComponent } from '../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';

@Component({
  selector: 'app-wrapper-header',
  imports: [KcIconComponent, KcButtonComponent, RouterModule, SearchBarComponent, CopyButtonComponent, WalletProfileOrbComponent],
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

  walletName = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getName() || 'Wallet';
  });

  accountName = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getAccountName() || 'Account 1';
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



  onSettingsClick(): void {
    // Navigate to settings page or implement settings logic
    console.log('Settings clicked');
  }



  toggleAccountSettings(): void {
    this.accountSettingsService.toggle();
  }

  onCopyButtonClick(event: Event): void {
    event.stopPropagation();
  }
}
