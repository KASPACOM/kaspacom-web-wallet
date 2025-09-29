import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { KcButtonComponent } from '@kaspacom/ui';
import {
  NetworkService,
  SupportedNetwork,
} from '../../../../services/network.service';
import { AssetsStoreService } from '../../../../../services/assets-store.service';
import { L2WalletService } from '../../../../services/l2-wallet.service';

@Component({
  selector: 'app-network-selection',
  standalone: true,
  imports: [CommonModule, KcButtonComponent],
  template: `
    <div class="p-16">
      <div class="mb-16">
        <strong>Selected:</strong>
        <span>{{ selectedNetwork() }}</span>
      </div>
      <div class="flex flex-column gap-8">
        <kc-button
          [variant]="'primary'"
          [text]="'L1 Kaspa'"
          (buttonClick)="onSelect('L1')"
        ></kc-button>
        <kc-button
          [variant]="'primary'"
          [text]="'Kasplex'"
          (buttonClick)="onSelect('Kasplex')"
        ></kc-button>
        <kc-button
          [variant]="'tertiary'"
          [text]="'Igra (coming soon)'"
          (buttonClick)="onSelect('Igra')"
        ></kc-button>
      </div>
    </div>
  `,
})
export class NetworkSelectionComponent extends FlowPageBaseComponent {
  protected networkService: NetworkService = inject(NetworkService);
  protected assetsStore: AssetsStoreService = inject(AssetsStoreService);
  protected l2Wallet: L2WalletService = inject(L2WalletService);

  selectedNetwork = computed(() => this.networkService.getSelectedNetwork()());

  override get config(): IFlowPageConfig {
    return {
      id: 'network-selection',
      title: 'Select Network',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    };
  }

  async onSelect(network: SupportedNetwork) {
    if (network === 'Igra') {
      return; // disabled for now
    }
    this.networkService.setSelectedNetwork(network);
    // L2: connect and load balances
    if (network !== 'L1') {
      const connected = await this.l2Wallet.ensureConnected();
      if (connected) {
        await this.l2Wallet.refreshL2NativeBalance();
      }
    } else {
      // L1: reload data to reflect network
      await this.assetsStore.reloadAll();
    }
    // Close modal
    this.closeFlow();
  }
}
