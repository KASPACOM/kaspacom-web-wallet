import { Component } from '@angular/core';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../services/wallet-action.service';
import { NgIf } from '@angular/common';
import { WalletService } from '../../services/wallet.service';
import { AppWallet } from '../../classes/AppWallet';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
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
    const walletIds = Object.keys(
      this.walletActionService.getActiveWalletActionProcessors()()
    )
      .map((walletId) => parseInt(walletId))
      .filter(
        (walletId) =>
          this.walletActionService.getActiveWalletActionProcessors()()[walletId]
      );

    return walletIds.map(
      (walletId) => this.walletService.getWalletById(walletId)?.getName() || 'Unknow Wallet'
    );
  }

  getRpcConnectionStatus() {
    // Get the RPC connection status from the wallet service
    return this.kaspaNetworkActionsService.getConnectionStatusSignal();
  }
}
