import { Component } from '@angular/core';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../services/wallet-action.service';
import { NgIf } from '@angular/common';
import { WalletService } from '../../services/wallet.service';
import { AppWallet } from '../../classes/AppWallet';

@Component({
    selector: 'app-header',
    imports: [NgIf],
    templateUrl: './app-header.component.html',
    styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent {
  constructor(
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly walletActionService: WalletActionService,
    private readonly walletService: WalletService
  ) {}

  getWalletsWaitingActionsCount() {
    return Object.values(
      this.walletActionService.getWalletsWaitingActionList()()
    ).reduce((total, actions) => total + actions.length, 0);
  }

  getActiveWalletActionProcessors(): string[] {
    const walletIdsWithAccount = Object.keys(
      this.walletActionService.getActiveWalletActionProcessors()()
    )
      .filter(
        (walletIdWithAccount) =>
          this.walletActionService.getActiveWalletActionProcessors()()[walletIdWithAccount]
      );

    return walletIdsWithAccount.map(
      (walletIdWithAccount) => this.walletService.getWalletByIdAndAccount(walletIdWithAccount)?.getDisplayName() || 'Unknow Wallet'
    );
  }

  getRpcConnectionStatus() {
    // Get the RPC connection status from the wallet service
    return this.kaspaNetworkActionsService.getConnectionStatusSignal();
  }
}
