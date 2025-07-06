import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent, KcButtonComponent } from 'kaspacom-ui';
import { SearchBarComponent } from '../../home/search/search-bar/search-bar.component';
import { WalletService } from '../../../../../services/wallet.service';
import { UtilsHelper } from '../../../../../services/utils.service';

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

  getCurrentAccountName(): string {
    const currentWallet = this.walletService.getCurrentWallet();
    return currentWallet?.getDisplayName() || 'Account 1';
  }

  getCurrentWalletAddress(): string {
    const currentWallet = this.walletService.getCurrentWallet();
    return currentWallet?.getAddress() || '';
  }

  getShortenedAddress(): string {
    const address = this.getCurrentWalletAddress();
    return this.utilsHelper.shortenAddress(address);
  }

  onSettingsClick(): void {
    // Navigate to settings page or implement settings logic
    console.log('Settings clicked');
  }

  onCopyAddress(): void {
    const address = this.getCurrentWalletAddress();
    if (address) {
      navigator.clipboard.writeText(address);
      // You might want to show a toast notification here
    }
  }
}
