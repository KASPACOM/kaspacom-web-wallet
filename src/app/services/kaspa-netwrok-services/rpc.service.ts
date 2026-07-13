import { Injectable, inject } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { KaspaL1NetworkService } from './kaspa-l1-network.service';

@Injectable({
  providedIn: 'root',
})
export class RpcService {
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private RPC?: RpcClient;
  private network: string;
  private usingConfiguredRpcUrl = false;
  private usingResolver = false;
  private configuredRpcUrlIndex = 0;

  constructor() {
    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.refreshRpc();
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc(options?: { resetConfiguredRpcUrl?: boolean }) {
    const previousRpc = this.RPC;
    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.usingConfiguredRpcUrl = false;
    this.usingResolver = false;
    if (options?.resetConfiguredRpcUrl) {
      this.configuredRpcUrlIndex = 0;
    }

    const configuredRpcUrls = this.getConfiguredRpcUrls();
    if (configuredRpcUrls.length) {
      const url =
        configuredRpcUrls[this.configuredRpcUrlIndex] ?? configuredRpcUrls[0];
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
    this.refreshRpc();
    return true;
  }

  useResolver(): void {
    const previousRpc = this.RPC;
    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.usingConfiguredRpcUrl = false;
    this.usingResolver = true;
    this.RPC = new RpcClient({
      resolver: new Resolver(),
      encoding: Encoding.Borsh,
      networkId: this.network,
    });

    this.disconnectRpc(previousRpc);
  }

  setNetwork(network: string): boolean {
    if (!this.kaspaL1NetworkService.setCurrentNetwork(network)) {
      return false;
    }

    this.network = this.kaspaL1NetworkService.getNetworkId();
    this.configuredRpcUrlIndex = 0;

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
