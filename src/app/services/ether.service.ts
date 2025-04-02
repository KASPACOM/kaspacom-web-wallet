import { Injectable } from "@angular/core";
import { ethers, TransactionRequest } from "ethers";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: 'root',
})
export class EtherService {
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
}
