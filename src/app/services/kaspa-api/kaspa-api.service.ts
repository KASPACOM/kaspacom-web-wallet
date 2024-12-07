import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FullTransactionResponse } from './dtos/full-transaction-response.dto';

@Injectable({ providedIn: 'root' })
export class KaspaApiService {
  baseurl = environment.kaspaApiBaseurl;

  constructor(private readonly httpClient: HttpClient) {}

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
