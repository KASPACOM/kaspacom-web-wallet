import { Injectable } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { environment } from '../../../environments/environment';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';

@Injectable({
  providedIn: 'root',
})
export class RpcService {
  private RPC?: RpcClient;
  private network: string;

  constructor() {
    this.network = environment.kaspaNetwork;
    this.refreshRpc();
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc() {
    const previousRpc = this.RPC;
    let storedRpcUrl: string | null = null;
    try {
      storedRpcUrl = localStorage.getItem(LOCAL_STORAGE_KEYS.RPC_URL);
    } catch (err) {
      console.warn('Failed reading RPC URL from localStorage', err);
    }

    if (storedRpcUrl) {
      this.RPC = new RpcClient({
        url: storedRpcUrl,
        encoding: Encoding.Borsh,
        networkId: this.network,
      });
    } else {
      this.RPC = new RpcClient({
        resolver: new Resolver(),
        encoding: Encoding.Borsh,
        networkId: this.network,
      });
    }

    this.disconnectRpc(previousRpc);

    return this.getRpc();
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
