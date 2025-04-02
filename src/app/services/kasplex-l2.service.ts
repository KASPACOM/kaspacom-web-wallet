import { Injectable } from "@angular/core";
import { ethers } from "ethers";
import { environment } from "../../environments/environment";


export const KASPLEX_L2_NETWORK_DATA_PREFIX = 'kasplex';
@Injectable({
  providedIn: 'root',
})
export class KasplexL2Service {
  private kasplexL2Provider: ethers.JsonRpcProvider;
  constructor() {
    this.kasplexL2Provider = new ethers.JsonRpcProvider(environment.kasplexL2Config.rpcUrl, {
      name: environment.kasplexL2Config.name,
      chainId: environment.kasplexL2Config.chainId,
    });
  }

  getChainWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.kasplexL2Provider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    return await this.kasplexL2Provider.getBalance(address);
  }
}
