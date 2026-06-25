import { Injectable } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';
import { KaspaL1NetworkService } from './kaspa-l1-network.service';

@Injectable({
  providedIn: 'root',
})
export class RpcService {
  private RPC?: RpcClient;
  private network: string;
  private usingStoredRpcUrl = false;
  private usingConfiguredRpcUrl = false;
  private usingResolver = false;
  private configuredRpcUrlIndex = 0;

  constructor(private readonly kaspaL1NetworkService: KaspaL1NetworkService) {
    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.refreshRpc();
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc(options?: { skipStoredRpcUrl?: boolean; useResolver?: boolean }) {
    const previousRpc = this.RPC;
    this.network = this.kaspaL1NetworkService.getNetworkId();
    let storedRpcUrl: string | null = null;
    if (!options?.skipStoredRpcUrl) {
      try {
        storedRpcUrl = localStorage.getItem(LOCAL_STORAGE_KEYS.RPC_URL);
      } catch (err) {
        console.warn('Failed reading RPC URL from localStorage', err);
      }
    }

    this.usingStoredRpcUrl = !!storedRpcUrl;
    this.usingConfiguredRpcUrl = false;
    this.usingResolver = false;

    if (this.usingStoredRpcUrl) {
      this.RPC = new RpcClient({
        url: storedRpcUrl!,
        encoding: Encoding.Borsh,
        networkId: this.network,
      });
    } else if (!options?.useResolver && this.getConfiguredRpcUrls().length) {
      const urls = this.getConfiguredRpcUrls();
      const url = urls[this.configuredRpcUrlIndex] ?? urls[0];
      this.usingConfiguredRpcUrl = true;
      this.RPC = new RpcClient({
        url,
        encoding: Encoding.Borsh,
        networkId: this.network,
      });
    } else {
      this.usingResolver = true;
      this.RPC = new RpcClient({
        resolver: new Resolver(),
        encoding: Encoding.Borsh,
        networkId: this.network,
      });
    }

    this.disconnectRpc(previousRpc);

    return this.getRpc();
  }

  private getConfiguredRpcUrls(): string[] {
    return this.kaspaL1NetworkService.getCurrentNetwork().kaspaWrpcUrls ?? [];
  }

  clearStoredRpcUrl(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.RPC_URL);
    } catch (err) {
      console.warn('Failed clearing custom RPC URL from localStorage', err);
    }

    this.usingStoredRpcUrl = false;
  }

  isUsingStoredRpcUrl(): boolean {
    return this.usingStoredRpcUrl;
  }

  isUsingConfiguredRpcUrl(): boolean {
    return this.usingConfiguredRpcUrl;
  }

  isUsingResolver(): boolean {
    return this.usingResolver;
  }

  useNextConfiguredRpcUrl(): boolean {
    const urls = this.getConfiguredRpcUrls();
    if (this.configuredRpcUrlIndex + 1 >= urls.length) {
      return false;
    }

    this.configuredRpcUrlIndex++;
    this.refreshRpc({ skipStoredRpcUrl: true });
    return true;
  }

  useResolver(): void {
    this.refreshRpc({ skipStoredRpcUrl: true, useResolver: true });
  }

  setNetwork(network: string): boolean {
    if (!this.kaspaL1NetworkService.setCurrentNetwork(network)) {
      return false;
    }

    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.configuredRpcUrlIndex = 0;

    this.clearStoredRpcUrl();

    this.refreshRpc();
    return true;
  }

  private disconnectRpc(rpc: RpcClient | undefined): void {
    if (!rpc || rpc === this.RPC) {
      return;
    }

    rpc.disconnect().catch((err: unknown) => {
      console.warn('Failed disconnecting previous RPC client', err);
    });
  }

  getNetwork() {
    return this.network;
  }
}
