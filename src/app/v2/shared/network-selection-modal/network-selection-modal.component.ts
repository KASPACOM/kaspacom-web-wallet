import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from 'kaspacom-ui';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../services/wallet.service';
import { Router } from '@angular/router';
import { L1NetworkConfigInterface } from '../../../../environments/environment.interface';
import { RpcService } from '../../../services/kaspa-netwrok-services/rpc.service';
import { KaspaNetworkConnectionManagerService } from '../../../services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { KaspaL1NetworkService } from '../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { AppWallet } from '../../../classes/AppWallet';

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
  private rpcService = inject(RpcService);
  private kaspaConnectionManagerService = inject(
    KaspaNetworkConnectionManagerService,
  );
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  protected networks: EIP1193ProviderChain[];
  protected l1Networks = this.kaspaL1NetworkService.getAvailableNetworks();
  private l1NetworkSwitchGeneration = 0;

  isCurrentNetworkL2 = computed(() =>
    this.walletService.getIsL2DisplaySignal()(),
  );
  currentL2Network = computed(() =>
    this.ethereumWalletChainManager.getCurrentChainSignal()(),
  );
  currentL1Network = computed(() =>
    this.kaspaL1NetworkService.getCurrentNetworkSignal()(),
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

  isCurrentL1Network(network: L1NetworkConfigInterface): boolean {
    return (
      !this.isCurrentNetworkL2() &&
      this.currentL1Network().network === network.network
    );
  }

  async setL1Network(network: L1NetworkConfigInterface): Promise<void> {
    const switchGeneration = ++this.l1NetworkSwitchGeneration;
    const currentWallet = this.walletService.getCurrentWallet();
    currentWallet?.resetL1NetworkState();

    this.rpcService.setNetwork(network.network);
    this.walletService.setL2Display(false);
    this.ethereumWalletChainManager.setCurrentChain(undefined);
    this.onCloseAfterNetworkChanged();
    void this.reloadSelectedL1Network(currentWallet, switchGeneration);
  }

  private async reloadSelectedL1Network(
    currentWallet: AppWallet | undefined,
    switchGeneration: number,
  ): Promise<void> {
    await currentWallet?.stopListiningToWalletActions();
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    await this.kaspaConnectionManagerService
      .waitForConnection(true)
      .catch((err) => {
        console.warn('Failed connecting to selected Kaspa L1 network', err);
      });
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    await currentWallet?.refreshUtxosBalance();
    if (switchGeneration !== this.l1NetworkSwitchGeneration) {
      return;
    }

    currentWallet?.startListiningToWalletActions();
  }

  setL2Network(network: EIP1193ProviderChain): void {
    this.ethereumWalletChainManager.setCurrentChain(network.chainId);
    this.walletService.setL2Display(true);
    this.onCloseAfterNetworkChanged();
  }
}
