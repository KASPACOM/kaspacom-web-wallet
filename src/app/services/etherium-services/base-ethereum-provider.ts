import { ethers, FeeData, TransactionReceipt, TransactionRequest } from "ethers";
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

  async ethCall(transaction: any, blockTag: string = 'latest'): Promise<string> {
    return await this.etherProvider.send('eth_call', [transaction, blockTag]);
  }

  async ethBlockNumber(): Promise<string> {
    return await this.etherProvider.send('eth_blockNumber', []);
  }

  async ethEstimateGas(transaction: any): Promise<string> {
    return await this.etherProvider.send('eth_estimateGas', [transaction]);
  }

  async ethGetTransactionByHash(txHash: string): Promise<any> {
    return await this.etherProvider.send('eth_getTransactionByHash', [txHash]);
  }

  async ethGetTransactionReceipt(txHash: string): Promise<any> {
    return await this.etherProvider.send('eth_getTransactionReceipt', [txHash]);
  }

  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    if (!txHash) {
      throw new Error('Transaction hash is empty');
    }

    return await this.etherProvider.waitForTransaction(txHash);
  }

  async estimateGas(wallet: ethers.Wallet, transaction: TransactionRequest): Promise<bigint> {
    const populatedTransaction = await wallet.populateTransaction(transaction);

    return await this.etherProvider.estimateGas(populatedTransaction);
  }

  async getFeeData(): Promise<FeeData> {
    return await this.etherProvider.getFeeData();
  }

  async supportsEIP1559() {
    const block = await this.etherProvider.getBlock("latest");
    return block && block.baseFeePerGas != null;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.etherProvider;
  }

  getConfig(): EIP1193ProviderChain {
    return this.config;
  }

  disconnect(): void {
    this.etherProvider.destroy();
  }
}
