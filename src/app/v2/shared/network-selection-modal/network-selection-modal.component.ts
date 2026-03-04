import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from 'kaspacom-ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../services/wallet.service';
import { NetworkConfigService } from '../../../services/network-config.service';
import { Router } from '@angular/router';

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
  private networkConfigService = inject(NetworkConfigService);
  private router = inject(Router);

  protected networks: EIP1193ProviderChain[];

  isCurrentNetworkL2 = computed(() => this.walletService.getIsL2DisplaySignal()());
  currentL2Network = computed(() => this.ethereumWalletChainManager.getCurrentChainSignal()());

  l1Networks = computed(() => this.networkConfigService.getPresetNetworks());
  activeL1 = computed(() => this.networkConfigService.getActiveNetworkSignal()());

  constructor() {
    this.networks = Object.values(this.ethereumWalletChainManager.getAllChainsByChainId());
  }

  getNetworkName(network: EIP1193ProviderChain) {
    return network.chainName;
  }

  onClose(): void {
    this.flowPagesService.closePage();
  }

  onCloseAfterNetworkChanged(): void {
    this.router.navigate(['/app/home']);
    this.onClose();
  }

  getNetworkIcon(network: EIP1193ProviderChain): string {
    return this.ethereumWalletChainManager.getChainEnvConfig(network.chainId)?.icon || '🌐';
  }

  isCurrentNetwork(networkId: string): boolean {
    return this.ethereumWalletChainManager.getCurrentChainSignal()?.() == networkId;
  }

  isCurrentL1(id: string): boolean {
    return this.activeL1().id === id;
  }

  setL1Network(networkId?: string): void {
    if (networkId) {
      this.networkConfigService.setActiveNetwork(networkId);
    }
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
