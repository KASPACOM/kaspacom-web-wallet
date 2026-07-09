import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { FullTransactionResponse } from './dtos/full-transaction-response.dto';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

@Injectable({ providedIn: 'root' })
export class KaspaApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);


  get baseurl(): string {
    return this.kaspaL1NetworkService.getKaspaApiBaseurl();
  }

  getFullTransactions(walletAddress: string, resolvePreviousOutputs: string = 'light', limit: number = 10): Observable<FullTransactionResponse> {
    const url = `${this.baseurl}/addresses/${walletAddress}/full-transactions?resolve_previous_outpoints=${resolvePreviousOutputs}&limit=${limit}`;

    return this.httpClient.get<FullTransactionResponse>(url);
  }

  getCommitTransactionsAddressess(transactions: FullTransactionResponse): string[] {
    const results: {[adress: string]: true} = {};

    for (const transaction of transactions) {
      for (const output of transaction.outputs) {
        if (output.script_public_key_type == 'scripthash') {
          results[output.script_public_key_address] = true;
        }
      }
    }

    return Object.keys(results);
  }
}
