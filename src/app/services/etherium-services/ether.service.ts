import { Injectable } from "@angular/core";
import { ethers, TransactionRequest } from "ethers";
import { EthereumWalletChainManager } from "./etherium-wallet-chain.manager";
import { L2TransactionHistoryService } from "../l2-services/l2-transaction-history.service";
import { BaseEthereumProvider } from "./base-ethereum-provider";

@Injectable({
  providedIn: 'root',
})
export class EtherService {
  constructor(protected ethereumChainService: EthereumWalletChainManager, protected l2TransactionHistoryService: L2TransactionHistoryService) {
  }

  async createTransactionAndPopulate(options: TransactionRequest, wallet: ethers.Wallet): Promise<TransactionRequest> {
    // Basic transaction data
    const txData: TransactionRequest = options;

    return await wallet.populateTransaction(txData);
  }

  async signTransaction(transaction: TransactionRequest, wallet: ethers.Wallet): Promise<string> {
    return await wallet.signTransaction(transaction);
  }

  encodeTransactionPayload(signedTransaction: string): Uint8Array {
    const chainConfig = this.ethereumChainService.getChainEnvConfig(this.ethereumChainService.getCurrentChainSignal()()!);

    if (chainConfig?.l1TransactionPrefix) {
      return this.encodeTransactionPayloadWithPrefix(signedTransaction, chainConfig.l1TransactionPrefix);
    } else {
      throw new Error(`Unsupported chain id: ${this.ethereumChainService.getCurrentChainSignal()()}`);
    }
  }

  async sendTransactionToL2(provider: BaseEthereumProvider, signedTransaction: string): Promise<string> {
    const resultHash = await provider.submitTransaction(signedTransaction);

    this.l2TransactionHistoryService.addTransactionAndWaitForResult(signedTransaction);

    return resultHash;
  }


  private encodeTransactionPayloadWithPrefix(signedTransaction: string, prefix?: string): Uint8Array {
    let payload = new Uint8Array();
    if (prefix) {
      payload = new TextEncoder().encode(prefix);
      payload = new Uint8Array([...payload, 0x01]);
    }

    // Append vmData (assuming vmData is a Uint8Array)
    return new Uint8Array([...payload, ...ethers.getBytes(signedTransaction)]);
  }
}
