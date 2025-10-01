import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BalanceComponent } from './balance/balance.component';
import { CryptoActionsComponent } from './crypto-actions/crypto-actions.component';
import { L1AssetsContainerComponent } from './assets-container/l1-assets-container.component';
import { L2AssetsContainerComponent } from './assets-container/l2-assets-container.component';
import { WalletService } from '../../../../services/wallet.service';
import { NetworkSelectionService } from '../../../../services/network-selection.service';
import { KaspaNetworkActionsService } from '../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    BalanceComponent,
    CryptoActionsComponent,
    L1AssetsContainerComponent,
    L2AssetsContainerComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private walletService = inject(WalletService);
  private networkSelectionService = inject(NetworkSelectionService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);

  kasBalance = computed<number | null>(() => {
    const wallet = this.walletService.getCurrentWallet();
    const currentNetwork = this.currentNetwork();

    if (!wallet) {
      return null;
    }

    if (currentNetwork === 'l1-kaspa') {
      const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
      if (!balanceData) {
        return null;
      }
      return this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature);
    } else {
      // For L2 networks
      const l2State = wallet.getL2WalletStateSignal()();
      if (!l2State) {
        return null;
      }
      return l2State.balanceFormatted;
    }
  });

  currentNetwork = computed(() => {
    return this.networkSelectionService.getCurrentNetwork();
  });

  assetsContainerComponent = computed(() => {
    const network = this.currentNetwork();
    return network === 'l1-kaspa'
      ? L1AssetsContainerComponent
      : L2AssetsContainerComponent;
  });

  ngOnInit() {}
}
