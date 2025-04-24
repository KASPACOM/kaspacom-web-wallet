import { inject, Injectable } from "@angular/core";
import { ethers, TransactionRequest } from "ethers";
import { BaseL2Service } from "./l2/base-l2.service";
import { KasplexL2Service } from "./l2/kasplex-l2.service";

@Injectable({
  providedIn: 'root',
})
export class EtherService {
  kasplexL2Service: KasplexL2Service = inject(KasplexL2Service);

  protected providersByProtocolPrefix: Record<string, BaseL2Service> = {
    kasplex: this.kasplexL2Service,
  };

  constructor() {
  }

  async createTransactionAndPopulate(options: TransactionRequest, wallet: ethers.Wallet): Promise<TransactionRequest> {
    // Basic transaction data
    const txData: TransactionRequest = options;

    return await wallet.populateTransaction(txData);
  }

  async signTransaction(transaction: TransactionRequest, wallet: ethers.Wallet): Promise<string> {
    return await wallet.signTransaction(transaction);
  }

  encodeTransactionToKasplexL2Format(signedTransaction: string, prefix?: string): Uint8Array {
    let payload = new Uint8Array();
    if (prefix) {
      payload = new TextEncoder().encode(prefix);
      payload = new Uint8Array([...payload, 0x01]);
    }
    
    // Append vmData (assuming vmData is a Uint8Array)
    return new Uint8Array([...payload, ...ethers.getBytes(signedTransaction)]);
  }

  async sendTransactionToL2(protocolPrefix: string, signedTransaction: string): Promise<string> {
    const providerService = this.providersByProtocolPrefix[protocolPrefix];

    if (!providerService) {
      throw new Error(`Unsupported protocol prefix: ${protocolPrefix}`);
    }

    return await providerService.submitTransaction(signedTransaction);
  }
}
