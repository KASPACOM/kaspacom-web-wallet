import { Injectable, signal } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
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

  private networks: NetworkConfig[] = [
    {
      id: 'l1-kaspa',
      name: 'kaspa',
      displayName: 'Kaspa L1',
      enabled: true,
      icon: '🌐',
    },
    {
      id: 'kasplex',
      name: 'kasplex',
      displayName: 'Kasplex',
      enabled: true,
      icon: '💎',
    },
    {
      id: 'igra',
      name: 'igra',
      displayName: 'Igra',
      enabled: false, // Disabled for now as per requirements
      icon: '🎮',
    },
  ];

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
