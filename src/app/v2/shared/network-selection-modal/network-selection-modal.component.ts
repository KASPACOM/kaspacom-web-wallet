import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from '@kaspacom/ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../services/wallet.service';

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

  protected networks: EIP1193ProviderChain[];

  isCurrentNetworkL2 = computed(() => this.walletService.getIsL2DisplaySignal()());
  currentL2Network = computed(() => this.ethereumWalletChainManager.getCurrentChainSignal()());


  constructor() {
    this.networks = Object.values(this.ethereumWalletChainManager.getAllChainsByChainId());
  }

  getNetworkName(network: EIP1193ProviderChain) {
    return network.chainName;
  }

  onClose(): void {
    this.flowPagesService.closePage();
  }

  getNetworkIcon(network: EIP1193ProviderChain): string {
    return this.ethereumWalletChainManager.getChainEnvConfig(network.chainId)?.icon || '🌐';
  }

  isCurrentNetwork(networkId: string): boolean {
    return this.ethereumWalletChainManager.getCurrentChainSignal() && this.ethereumWalletChainManager.getCurrentChainSignal()() == networkId;
  }

  setL1Network(): void {
    this.walletService.setL2Display(false);
    this.ethereumWalletChainManager.setCurrentChain(undefined);
    this.flowPagesService.closePage();
  }

  setL2Network(network: EIP1193ProviderChain): void {
    this.ethereumWalletChainManager.setCurrentChain(network.chainId);
    this.walletService.setL2Display(true);
    this.flowPagesService.closePage();
  }
}
