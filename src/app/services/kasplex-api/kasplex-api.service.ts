import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { GetTokenWalletInfoDto } from './dtos/get-token-wallet-info.dto';
import { GetTokenListResponse } from './dtos/token-list-info.dto';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class KasplexKrc20Service {
  baseurl = environment.kasplexApiBaseurl;

  constructor(private readonly httpClient: HttpClient) {}

  getBurntKRC20Balance(ticker: string): Observable<number | null> {
    return this.getTokenWalletBalanceInfo(
      'kaspa:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkx9awp4e',
      ticker
    ).pipe(
      map((response: GetTokenWalletInfoDto | null) =>
        response && response.balance ? response.balance / 1e8 : null
      )
    );
  }

  getWalletTokenList(
    address: string,
    paginationKey: string | null = null,
    direction: 'next' | 'prev' | null = null
  ): Observable<GetTokenListResponse> {
    let queryParam = '';
    if (paginationKey && direction) {
      queryParam = `?${direction}=${paginationKey}`;
    }

    const url = `${this.baseurl}/krc20/address/${address}/tokenlist${queryParam}`;

    return this.httpClient.get<GetTokenListResponse>(url).pipe(
      catchError((err) => {
        console.error(`Error fetching token list for address ${address}:`, err);
        return of({ result: [], next: null, prev: null });
      })
    );
  }

  getTokenWalletBalanceInfo(
    address: string,
    ticker: string
  ): Observable<GetTokenWalletInfoDto | null> {
    const url = `${this.baseurl}/krc20/address/${address}/token/${ticker}`;
    return this.httpClient.get<{ results: GetTokenWalletInfoDto[] }>(url).pipe(
      map((response: any) => {
        const results = response.result;
        return results.length > 0
          ? {
              address,
              ...results[0],
              balance: results[0].balance / 1e8,
            }
          : null;
      }),
      catchError((err) => {
        console.error(
          `Error fetching token info for ${ticker} at address ${address}:`,
          err
        );
        return of(null);
      })
    );
  }

  getDevWalletBalance(devWallet: string, ticker: string): Observable<number> {
    const url = `${this.baseurl}/krc20/address/${devWallet}/token/${ticker}`;
    return this.httpClient.get<{ result: { balance: string }[] }>(url).pipe(
      map((response) => {
        const balance = response.result?.[0]?.balance || '0';
        return parseFloat(balance) / 1e8;
      }),
      catchError(() => of(0))
    );
  }

  // getWalletActivity(
  //   address: string,
  //   paginationKey: string | null = null,
  //   direction: string | null = null
  // ): Observable<ant> {
  //   let queryParam = '';
  //   if (paginationKey && direction) {
  //     queryParam = `&${direction}=${paginationKey}`;
  //   }

  //   const url = `${this.baseurl}/krc20/oplist?address=${address}${queryParam}`;

  //   return this.httpClient
  //     .get<{ result: any[]; next: string | null; prev: string | null }>(url)
  //     .pipe(
  //       map((response) => {
  //         const operations = response.result;

  //         if (operations.length === 0) {
  //           return {
  //             activityItems: [],
  //             next: null,
  //             prev: null,
  //           };
  //         }

  //         const activityItems: TokenRowActivityItem[] = operations.map((op) => {
  //           let type: string;
  //           switch (op.op) {
  //             case 'transfer':
  //               type = 'Transfer';
  //               break;
  //             case 'mint':
  //               type = 'Mint';
  //               break;
  //             case 'deploy':
  //               type = 'Deploy';
  //               break;
  //             default:
  //               type = 'Unknown';
  //               break;
  //           }

  //           const amount = op.amt
  //             ? (parseInt(op.amt) / 100000000).toFixed(2)
  //             : '---';

  //           return {
  //             ticker: op.tick,
  //             amount,
  //             type,
  //             time: new Date(parseInt(op.mtsAdd)).toLocaleString(),
  //           };
  //         });

  //         return {
  //           activityItems,
  //           next: response.next || null,
  //           prev: response.prev || null,
  //         };
  //       }),
  //       catchError((err) => {
  //         console.error('Error fetching wallet activity:', err);
  //         return of({ activityItems: [], next: null, prev: null });
  //       })
  //     );
  // }
}
