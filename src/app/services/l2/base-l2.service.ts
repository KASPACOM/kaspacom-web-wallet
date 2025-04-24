import { ethers } from "ethers";
import { L2ConfigInterface } from "../../../environments/environment.interface";

export class BaseL2Service {
  protected l2Provider: ethers.JsonRpcProvider;
  constructor(protected l2Config: L2ConfigInterface) {
    this.l2Provider = new ethers.JsonRpcProvider(l2Config.rpcUrls.default.http[0], {
      name: l2Config.name,
      chainId: l2Config.chainId,
    });
  }

  getChainWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.l2Provider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    return await this.l2Provider.getBalance(address);
  }

  async submitTransaction(transaction: string): Promise<string> {
    return await this.l2Provider.send('eth_sendRawTransaction', [transaction]);
  }
}
