import { Injectable, effect } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { NetworkConfigService } from '../network-config.service';

@Injectable({
  providedIn: 'root',
})
export class RpcService {
  private RPC?: RpcClient;

  constructor(private networkConfigService: NetworkConfigService) {
    this.refreshRpc();

    // Re-connect RPC when network changes
    effect(() => {
      this.networkConfigService.getActiveNetworkSignal()();
      this.refreshRpc();
    });
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc() {
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
    
    const networkConfig = this.networkConfigService.getActiveNetwork();
    
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

    return this.getRpc();
  }

  getNetwork() {
    return this.networkConfigService.getActiveNetwork().networkId;
  }
}
