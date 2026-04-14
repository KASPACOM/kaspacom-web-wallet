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
    if (localStorage.getItem(LOCAL_STORAGE_KEYS.RPC_URL)) {
      this.RPC = new RpcClient({
        url: localStorage.getItem(LOCAL_STORAGE_KEYS.RPC_URL) || '',
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


    return this.getRpc();
  }

  getNetwork() {
    return this.network;
  }
}
