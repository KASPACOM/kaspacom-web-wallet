import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from 'kaspacom-ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../services/wallet.service';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'network-selection-modal',
  imports: [CommonModule, KcIconComponent],
  templateUrl: './network-selection-modal.component.html',
  styleUrl: './network-selection-modal.component.scss',
})
export class NetworkSelectionModalComponent {
  private ethereumWalletChainManager = inject(EthereumWalletChainManager);
  private flowPagesService = inject(FlowPagesService);
  private walletService = inject(WalletService);
  private router = inject(Router);

  protected networks: EIP1193ProviderChain[];
  protected l1Config = environment.l1Config;

  isCurrentNetworkL2 = computed(() =>
    this.walletService.getIsL2DisplaySignal()(),
  );
  currentL2Network = computed(() =>
    this.ethereumWalletChainManager.getCurrentChainSignal()(),
  );

  constructor() {
    this.networks = Object.values(
      this.ethereumWalletChainManager.getAllChainsByChainId(),
    );
  }

  onClose(): void {
    this.flowPagesService.closePage();
  }

  onCloseAfterNetworkChanged(): void {
    this.router.navigate(['/app/home']);
    this.onClose();
  }

  getNetworkIcon(network: EIP1193ProviderChain): string | null {
    return (
      this.ethereumWalletChainManager.getChainEnvConfig(network.chainId)
        ?.icon || null
    );
  }

  getNetworkShortName(network: EIP1193ProviderChain): string {
    const envConfig = this.ethereumWalletChainManager.getChainEnvConfig(
      network.chainId,
    );
    return envConfig?.shortName || network.chainName;
  }

  isCurrentNetwork(networkId: string): boolean {
    return (
      this.ethereumWalletChainManager.getCurrentChainSignal()() === networkId
    );
  }

  setL1Network(): void {
    this.walletService.setL2Display(false);
    this.ethereumWalletChainManager.setCurrentChain(undefined);
    this.onCloseAfterNetworkChanged();
  }

  setL2Network(network: EIP1193ProviderChain): void {
    this.ethereumWalletChainManager.setCurrentChain(network.chainId);
    this.walletService.setL2Display(true);
    this.onCloseAfterNetworkChanged();
  }
}
