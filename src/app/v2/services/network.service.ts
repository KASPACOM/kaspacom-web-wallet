import { Injectable, Signal, computed, signal } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';
import { EthereumWalletChainManager } from '../../services/etherium-services/etherium-wallet-chain.manager';
import { environment } from '../../../environments/environment';

export type SupportedNetwork = 'L1' | 'Kasplex' | 'Igra';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private selectedNetworkSignal = signal<SupportedNetwork>(
    (localStorage.getItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_NETWORK,
    ) as SupportedNetwork) || 'L1',
  );

  constructor(private ethereumChainManager: EthereumWalletChainManager) {
    // Ensure Ethereum provider reflects current selection on init
    this.applySelectionSideEffects(this.selectedNetworkSignal());
  }

  getSelectedNetwork(): Signal<SupportedNetwork> {
    return this.selectedNetworkSignal.asReadonly();
  }

  setSelectedNetwork(network: SupportedNetwork): void {
    if (this.selectedNetworkSignal() === network) return;
    this.selectedNetworkSignal.set(network);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_SELECTED_NETWORK, network);
    this.applySelectionSideEffects(network);
  }

  isL2Selected(): boolean {
    const n = this.selectedNetworkSignal();
    return n === 'Kasplex' || n === 'Igra';
  }

  private applySelectionSideEffects(network: SupportedNetwork) {
    // When L1 selected → clear Ethereum chain selection
    if (network === 'L1') {
      this.ethereumChainManager.setCurrentChain(undefined);
      return;
    }

    // For L2 selections map to environment.l2Configs
    if (network === 'Kasplex') {
      const hex = this.ethereumChainManager.convertChainIdToHex(
        environment.l2Configs.kasplex.chainId,
      );
      this.ethereumChainManager.setCurrentChain(hex);
      return;
    }

    if (network === 'Igra') {
      // Disabled: do not set any chain provider yet
      this.ethereumChainManager.setCurrentChain(undefined);
      return;
    }
  }
}
