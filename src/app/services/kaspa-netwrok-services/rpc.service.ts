import { Injectable, effect } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { NetworkConfigService } from '../network-config.service';

@Injectable({
  providedIn: 'root',
})
export class RpcService {
  private RPC?: RpcClient;
  /** Track which network the current RPC client was created for */
  private currentNetworkId?: string;

  constructor(private networkConfigService: NetworkConfigService) {
    this.refreshRpc();
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc() {
    const networkConfig = this.networkConfigService.getActiveNetwork();

    // Skip if we already have a client for this network
    if (this.RPC && this.currentNetworkId === networkConfig.networkId) {
      return this.getRpc();
    }

    // Disconnect old client before creating a new one
    if (this.RPC) {
      try {
        const disconnectResult = this.RPC.disconnect();
        // Handle both sync and async disconnect
        if (disconnectResult && typeof disconnectResult.catch === 'function') {
          disconnectResult.catch(() => {});
        }
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    const rpcOptions: any = {
      encoding: Encoding.Borsh,
      networkId: networkConfig.networkId,
    };

    if (networkConfig.useResolver) {
      rpcOptions.resolver = new Resolver();
    } else {
      rpcOptions.url = networkConfig.wrpcUrl;
    }

    this.RPC = new RpcClient(rpcOptions);
    this.currentNetworkId = networkConfig.networkId;

    return this.getRpc();
  }

  getNetwork() {
    return this.networkConfigService.getActiveNetwork().networkId;
  }
}
