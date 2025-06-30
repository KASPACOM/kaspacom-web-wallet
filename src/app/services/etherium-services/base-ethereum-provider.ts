import { ethers } from "ethers";
import { EIP1193ProviderChain } from "@kaspacom/wallet-messages";
import { environment } from "../../../environments/environment";

export class BaseEthereumProvider {
  protected etherProvider: ethers.JsonRpcProvider;
  constructor(protected config: EIP1193ProviderChain) {
    const additionalOptions: ethers.JsonRpcApiProviderOptions = {
      batchMaxCount: environment.isProduction ? 100 : 1,
    };


    this.etherProvider = new ethers.JsonRpcProvider(config.rpcUrls[0], {
      name: config.chainName,
      chainId: parseInt(config.chainId, 16),
    }, additionalOptions);
  }

  getChainWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.etherProvider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    return await this.etherProvider.getBalance(address);
  }

  async submitTransaction(transaction: string): Promise<string> {
    return await this.etherProvider.send('eth_sendRawTransaction', [transaction]);

    // // Retry checking for the transaction up to 5 times (once per second)
    // let retries = 5;
    // while (retries > 0) {
    //   const tx = await this.etherProvider.send('eth_getTransactionByHash', [txHash]);
    //   if (tx) {
    //     console.log(tx.blockNumber === null ? 'Transaction is pending...' : `Mined in block ${tx.blockNumber}`);
    //     return txHash;
    //   }

    //   // Wait 1 second before retrying
    //   await new Promise((res) => setTimeout(res, 1000));
    //   retries--;
    // }

    // throw new Error('Transaction not found after 5 attempts');
  }

  getConfig(): EIP1193ProviderChain {
    return this.config;
  }

  disconnect(): void {
    this.etherProvider.destroy();
  }

  fromReadableNumberToBlockchainNumber(value: number): bigint {
    return BigInt(value) * BigInt(10 ** (this.config.nativeCurrency.decimals || 18));
  }

  fromBlockchainNumberToReadableNumber(value: bigint): number {
    return Number(value) / (10 ** (this.config.nativeCurrency.decimals || 18));
  }
}
