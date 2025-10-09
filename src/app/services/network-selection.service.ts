import { Injectable, signal } from '@angular/core';
import { LOCAL_STORAGE_KEYS, KASPA_NETWORKS } from '../config/consts';
import { environment } from '../../environments/environment';

export type NetworkType = 'l1-kaspa' | 'kasplex' | 'igra';

export interface NetworkConfig {
  id: NetworkType;
  name: string;
  displayName: string;
  enabled: boolean;
  icon?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NetworkSelectionService {
  private currentNetwork = signal<NetworkType>(
    (localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_NETWORK) as NetworkType) ||
      'l1-kaspa',
  );

  private getNetworkConfig(): NetworkConfig[] {
    const isMainnet = environment.kaspaNetwork === KASPA_NETWORKS.MAINNET;
    const kaspaNetworkName = isMainnet ? 'Kaspa Mainnet' : 'Kaspa Testnet-10';
    const kaspaNetworkFullName = `${kaspaNetworkName} (Layer 1)`;

    return [
      {
        id: 'l1-kaspa',
        name: kaspaNetworkFullName,
        displayName: isMainnet ? 'Kaspa Mainnet' : 'Kaspa Testnet',
        enabled: true,
        icon: '🌐',
      },
      {
        id: 'kasplex',
        name: 'Kasplex (Layer 2 DEX)',
        displayName: 'Kasplex',
        enabled: true,
        icon: '💎',
      },
      {
        id: 'igra',
        name: 'Igra (Layer 2 DEX)',
        displayName: 'Igra Test',
        enabled: false,
        icon: '🚀',
      },
    ];
  }

  private get networks(): NetworkConfig[] {
    return this.getNetworkConfig();
  }

  constructor() {
    // Initialize with available networks from environment if needed
    if (environment.l2Configs) {
      // Could extend this to dynamically load networks from environment
    }
  }

  public getCurrentNetworkSignal() {
    return this.currentNetwork.asReadonly();
  }

  public getCurrentNetwork(): NetworkType {
    return this.currentNetwork();
  }

  public setCurrentNetwork(network: NetworkType) {
    const networkConfig = this.networks.find((n) => n.id === network);
    if (!networkConfig || !networkConfig.enabled) {
      console.warn(`Network ${network} is not available or disabled`);
      return;
    }

    localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_NETWORK, network);
    this.currentNetwork.set(network);
  }

  public getNetworks(): NetworkConfig[] {
    return this.networks.filter((network) => network.enabled);
  }

  public getAllNetworks(): NetworkConfig[] {
    return this.networks;
  }

  public getNetworkById(networkId: NetworkType): NetworkConfig | undefined {
    return this.networks.find((network) => network.id === networkId);
  }

  public getCurrentNetworkConfig(): NetworkConfig | undefined {
    return this.getNetworkById(this.currentNetwork());
  }

  public isL2Network(): boolean {
    const current = this.currentNetwork();
    return current === 'kasplex' || current === 'igra';
  }

  public isL1Network(): boolean {
    return this.currentNetwork() === 'l1-kaspa';
  }
}
