import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { L1NetworkConfigInterface } from '../../../environments/environment.interface';
import { KASPA_NETWORKS, LOCAL_STORAGE_KEYS } from '../../config/consts';

@Injectable({
  providedIn: 'root',
})
export class KaspaL1NetworkService {
  private readonly networks: L1NetworkConfigInterface[] =
    environment.l1Config.networks?.length
      ? environment.l1Config.networks
      : [];

  private readonly currentNetworkSignal: WritableSignal<L1NetworkConfigInterface> =
    signal(this.resolveInitialNetwork());

  getAvailableNetworks(): L1NetworkConfigInterface[] {
    return [...this.networks];
  }

  getCurrentNetworkSignal(): Signal<L1NetworkConfigInterface> {
    return this.currentNetworkSignal.asReadonly();
  }

  getCurrentNetwork(): L1NetworkConfigInterface {
    return this.currentNetworkSignal();
  }

  getNetworkId(): string {
    return this.getCurrentNetwork().network;
  }

  isMainnet(): boolean {
    return this.getNetworkId() === KASPA_NETWORKS.MAINNET;
  }

  getKaspaApiBaseurl(): string {
    return this.getCurrentNetwork().kaspaApiBaseurl;
  }

  getKaspaComApiBaseurl(): string {
    return this.getCurrentNetwork().kaspaComApiBaseurl;
  }

  getKaspaComDefiApiBaseurl(): string {
    return this.getCurrentNetwork().kaspaComDefiApiBaseurl;
  }

  getKasplexApiBaseurl(): string | undefined {
    return this.getCurrentNetwork().kasplexApiBaseurl;
  }

  getKrc721ApiBaseurl(): string | undefined {
    return this.getCurrentNetwork().krc721ApiBaseurl;
  }

  getKrc721CacheStreamUrl(): string | undefined {
    return this.getCurrentNetwork().krc721CacheStreamUrl;
  }

  getKnsApiBaseurl(): string | undefined {
    return this.getCurrentNetwork().knsApiBaseurl;
  }

  getCovenantIndexerApiBaseurl(): string | undefined {
    return this.getCurrentNetwork().covenantIndexerApiBaseurl;
  }

  getKaspaExplorerBaseurl(): string {
    return this.getCurrentNetwork().kaspaExplorerBaseurl;
  }

  getCovenantExplorerBaseurl(): string | undefined {
    return this.getCurrentNetwork().covenantExplorerBaseurl;
  }

  supportsKrc20Assets(): boolean {
    return !!this.getKasplexApiBaseurl();
  }

  supportsKrc721Assets(): boolean {
    return !!this.getKrc721ApiBaseurl();
  }

  supportsKnsAssets(): boolean {
    return !!this.getKnsApiBaseurl();
  }

  setCurrentNetwork(network: string): boolean {
    const nextNetwork = this.networks.find((item) => item.network === network);
    if (!nextNetwork) {
      return false;
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.KASPA_L1_NETWORK, network);
    } catch (err) {
      console.warn('Failed saving Kaspa L1 network to localStorage', err);
    }

    this.currentNetworkSignal.set(nextNetwork);
    return true;
  }

  private resolveInitialNetwork(): L1NetworkConfigInterface {
    if (!this.networks.length) {
      throw new Error(
        'No Kaspa L1 networks configured. Check environment.l1Config.networks.',
      );
    }

    const defaultNetwork =
      this.networks.find((item) => item.network === environment.kaspaNetwork) ??
      this.networks[0];

    try {
      const storedNetwork = localStorage.getItem(
        LOCAL_STORAGE_KEYS.KASPA_L1_NETWORK,
      );
      return (
        this.networks.find((item) => item.network === storedNetwork) ??
        defaultNetwork
      );
    } catch (err) {
      console.warn('Failed reading Kaspa L1 network from localStorage', err);
      return defaultNetwork;
    }
  }
}
