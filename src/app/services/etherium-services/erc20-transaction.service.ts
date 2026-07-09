import { Injectable, inject } from '@angular/core';
import { WalletService } from '../wallet.service';

// TODO: Implement L2 transaction history fetching using indexer API

export interface ERC20Transaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  gasUsed?: string;
  gasPrice?: string;
  status: 'accepted' | 'rejected' | 'pending';
}

@Injectable({
  providedIn: 'root',
})
export class Erc20TransactionService {
  private walletService = inject(WalletService);


  async getERC20TransactionHistory(
    walletAddress: string,
    limit: number = 50,
  ): Promise<ERC20Transaction[]> {
    // TODO: Implement transaction fetching
    return [];
  }
}
