import { Component, computed, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent, KcTooltipDirective } from 'kaspacom-ui';
import { environment } from '../../../../../../environments/environment';
import { EthereumWalletChainManager } from '../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { UtilsHelper } from '../../../../../services/utils.service';
import { WalletService } from '../../../../../services/wallet.service';
import { AccountSettingsService } from '../../../../services/account-settings.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { WalletProfileOrbComponent } from '../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';
import { FlowPageId } from '../flow-page/flow-page.registry';
import { DesktopViewService } from '../../../../services/desktop-view.service';
import { CHAIN_ID_LOGOS } from '../../../../shared/network-selection-modal/chain-id-logos';

@Component({
  selector: 'app-wrapper-header',
  imports: [
    KcIconComponent,
    RouterModule,
    CopyButtonComponent,
    WalletProfileOrbComponent,
    KcTooltipDirective,
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
  ethereumWalletChainManager = inject(EthereumWalletChainManager);
  desktopViewService = inject(DesktopViewService);

  // Use signals for reactive updates
  currentWallet = this.walletService.getCurrentWalletSignal();
  currentNetworkInfo = computed(() => {
    if (this.ethereumWalletChainManager.getCurrentChainSignal()()) {
      const envConfig = this.ethereumWalletChainManager.getChainEnvConfig(
        this.ethereumWalletChainManager.getCurrentChainSignal()()!,
      );
      const chainConfig = this.ethereumWalletChainManager.getChainConfig(
        this.ethereumWalletChainManager.getCurrentChainSignal()()!,
      );

      return {
        name: envConfig?.shortName || chainConfig?.chainName,
        icon: envConfig?.icon ||
          CHAIN_ID_LOGOS[this.ethereumWalletChainManager.getCurrentChainSignal()()!.toLowerCase()] ||
          null,
      };
    }

    return {
      name: environment.l1Config.shortName,
      icon: environment.l1Config.icon,
    };
  });

  walletName = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getName() || 'Wallet';
  });

  accountName = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getAccountName() || 'Account 1';
  });

  walletAddress = this.walletService.getCurrentDisplayWalletAddressAsString;

  shortenedAddress = computed(() => {
    const address = this.walletAddress();
    return address ? this.utilsHelper.shortenAddress(address) : '';
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

  isDevelopmentMode(): boolean {
    return !environment.isProduction;
  }
}
