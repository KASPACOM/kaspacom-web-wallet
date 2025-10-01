import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent, KcButtonComponent } from '@kaspacom/ui';
import { SearchBarComponent } from '../../home/search/search-bar/search-bar.component';
import { WalletService } from '../../../../../services/wallet.service';
import { UtilsHelper } from '../../../../../services/utils.service';
import { AccountSettingsService } from '../../../../services/account-settings.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { FlowPageId } from '../flow-page/flow-page.registry';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { WalletProfileOrbComponent } from '../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';
import { NetworkSelectionService } from '../../../../../services/network-selection.service';

@Component({
  selector: 'app-wrapper-header',
  imports: [
    KcIconComponent,
    KcButtonComponent,
    RouterModule,
    SearchBarComponent,
    CopyButtonComponent,
    WalletProfileOrbComponent,
  ],
  templateUrl: './wrapper-header.component.html',
  styleUrl: './wrapper-header.component.scss',
})
export class WrapperHeaderComponent {
  router = inject(Router);
  walletService = inject(WalletService);
  utilsHelper = inject(UtilsHelper);
  accountSettingsService = inject(AccountSettingsService);
  flowPagesService = inject(FlowPagesService);
  networkSelectionService = inject(NetworkSelectionService);

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
    const currentNetwork = this.currentNetwork();
    if (!wallet) {
      console.log('No wallet found in currentWallet signal');
      return '';
    }

    try {
      if (currentNetwork === 'l1-kaspa') {
        const address = wallet.getAddress();
        console.log('L1 Kaspa address:', address);
        return address;
      } else {
        // For L2 networks, get the L2 address
        const l2State = wallet.getL2WalletStateSignal()();
        if (l2State?.address) {
          console.log('L2 address:', l2State.address);
          return l2State.address;
        }
        // Fallback to L1 address if L2 address not available
        const address = wallet.getAddress();
        console.log('Fallback L1 address:', address);
        return address;
      }
    } catch (error) {
      console.error('Error getting wallet address:', error);
      return '';
    }
  });

  shortenedAddress = computed(() => {
    const address = this.walletAddress();
    return address ? this.utilsHelper.shortenAddress(address) : '';
  });

  currentNetwork = computed(() => {
    return this.networkSelectionService.getCurrentNetwork();
  });

  currentNetworkConfig = computed(() => {
    return this.networkSelectionService.getCurrentNetworkConfig();
  });

  onSettingsClick(): void {
    this.flowPagesService.openFlow({
      id: 'settings-menu' as FlowPageId,
      title: 'Settings',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  onNetworkSelectionClick(): void {
    this.flowPagesService.openFlow({
      id: 'network-selection' as FlowPageId,
      title: 'Select Network',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  toggleAccountSettings(): void {
    this.accountSettingsService.toggle();
  }

  onCopyButtonClick(event: Event): void {
    event.stopPropagation();
  }
}
