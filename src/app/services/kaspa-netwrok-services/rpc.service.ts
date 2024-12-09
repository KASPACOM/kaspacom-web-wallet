import { Injectable } from '@angular/core';
import { Encoding, Resolver, RpcClient } from '../../../../public/kaspa/kaspa';
import { environment } from '../../../environments/environment';

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
    (window as any).rpc = this.RPC;
    return this.RPC;
  }

  refreshRpc() {
    this.RPC = new RpcClient({
      resolver: new Resolver(),
      encoding: Encoding.Borsh,
      networkId: this.network,
    });

    return this.getRpc();
  }

  getNetwork() {
    return this.network;
  }
}
