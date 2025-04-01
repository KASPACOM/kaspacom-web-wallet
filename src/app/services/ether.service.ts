import { Injectable } from "@angular/core";
import { ethers } from "ethers";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: 'root',
})
export class EtherService {
    private etherProvider: ethers.JsonRpcProvider;
  constructor() {
    this.etherProvider = new ethers.JsonRpcProvider(environment.etherRpcUrl, {
        name: "Kasplex",
        chainId: environment.etherChainId,
    });
  }

  getEtherWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.etherProvider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    return await this.etherProvider.getBalance(address);
  }
}
