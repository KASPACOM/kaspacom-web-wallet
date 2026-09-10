import { ethers, FeeData, TransactionReceipt, TransactionRequest } from "ethers";
import { EIP1193ProviderChain } from "@kaspacom/wallet-messages";
import { environment } from "../../../environments/environment";

export class BaseEthereumProvider {
  protected etherProvider: ethers.JsonRpcProvider;
  private rpcUrlIndex = 0;
  constructor(protected config: EIP1193ProviderChain) {
    if (!config.rpcUrls.length) {
      throw new Error('EVM chain has no RPC URLs configured');
    }
    const additionalOptions: ethers.JsonRpcApiProviderOptions = {
      batchMaxCount: environment.isProduction ? 100 : 1,
    };


    this.etherProvider = this.createProvider(
      config.rpcUrls[0],
      additionalOptions,
    );
  }

  protected createProvider(
    rpcUrl: string,
    options: ethers.JsonRpcApiProviderOptions = {
      batchMaxCount: environment.isProduction ? 100 : 1,
    },
  ): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(
      rpcUrl,
      {
        name: this.config.chainName,
        chainId: parseInt(this.config.chainId, 16),
      },
      options,
    );
  }

  getChainWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.etherProvider);
  }

  async getWalletBalance(address: string): Promise<bigint> {
    const attempts = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.etherProvider.getBalance(address);
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) {
          this.rotateReadProvider();
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * Math.pow(2, attempt)),
          );
        }
      }
    }

    throw new EvmRpcReadError(
      'eth_getBalance',
      this.config.chainId,
      attempts,
      lastError,
    );
  }

  private rotateReadProvider(): void {
    try {
      this.etherProvider.destroy();
    } catch {
      // A provider that won't tear down must not block failover: this runs
      // inside the retry loop's catch, so a throw here would escape it and
      // bypass EvmRpcReadError.
    }
    this.rpcUrlIndex = (this.rpcUrlIndex + 1) % this.config.rpcUrls.length;
    this.etherProvider = this.createProvider(
      this.config.rpcUrls[this.rpcUrlIndex],
    );
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

export class EvmRpcReadError extends Error {
  constructor(
    readonly method: string,
    readonly chainId: string,
    readonly attempts: number,
    readonly originalError: unknown,
  ) {
    super(`${method} failed after ${attempts} attempts`);
    this.name = 'EvmRpcReadError';
  }
}
