import { inject, Injectable } from "@angular/core";
import { ethers, TransactionRequest } from "ethers";
import { BaseEthereumProvider } from "./base-ethereum-provider";
import { EthereumWalletChainManager } from "./etherium-wallet-chain.manager";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root',
})
export class EtherService {

  constructor(protected ethereumChainService: EthereumWalletChainManager) {
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

    switch (this.ethereumChainService.getCurrentChainSignal()()) {
      case this.ethereumChainService.convertChainIdToHex(environment.l2Configs.kasplex.chainId):
        return this.encodeTransactionPayloadWithPrefix(signedTransaction, environment.l2Configs.kasplex.l1PayloadPrefix);
      default:
        throw new Error(`Unsupported chain id: ${this.ethereumChainService.getCurrentChainSignal()()}`);
    }
  }

  async sendTransactionToL2(provider: BaseEthereumProvider, signedTransaction: string): Promise<string> {
    return await provider.submitTransaction(signedTransaction);
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
