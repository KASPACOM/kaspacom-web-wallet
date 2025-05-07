import { ethers } from "ethers";
import { EIP1193ProviderChain } from "kaspacom-wallet-messages";

export class BaseEthereumProvider {
  protected etherProvider: ethers.JsonRpcProvider;
  constructor(protected config: EIP1193ProviderChain) {
    
    this.etherProvider = new ethers.JsonRpcProvider(config.rpcUrls[0], {
      name: config.chainName,
      chainId: parseInt(config.chainId, 16),
    });
  }

  getChainWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.etherProvider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    return await this.etherProvider.getBalance(address);
  }

  async submitTransaction(transaction: string): Promise<string> {
    return await this.etherProvider.send('eth_sendRawTransaction', [transaction]);
  }

  getConfig(): EIP1193ProviderChain {
    return this.config;
  }

  disconnect(): void {
    this.etherProvider.destroy();
  }
}
