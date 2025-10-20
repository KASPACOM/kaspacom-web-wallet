import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from '@kaspacom/ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';

@Component({
  selector: 'l2-network-selection-modal',
  imports: [CommonModule, KcIconComponent],
  templateUrl: './l2-network-selection-modal.component.html',
  styleUrl: './l2-network-selection-modal.component.scss',
})
export class L2NetworkSelectionModalComponent {
  private ethereumWalletChainManager = inject(EthereumWalletChainManager);
  private flowPagesService = inject(FlowPagesService);

  protected networks: EIP1193ProviderChain[];
  

  constructor() {
    this.networks = Object.values(this.ethereumWalletChainManager.getAllChainsByChainId());
  }

  onNetworkSelect(networkId: string): void {
    this.ethereumWalletChainManager.setCurrentChain(networkId);
    this.flowPagesService.closePage();
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
}
