import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, firstValueFrom, map, Observable, of } from 'rxjs';
import { GetTokenWalletInfoDto } from './dtos/get-token-wallet-info.dto';
import {
  GetTokenInfoResponse,
  GetTokenListResponse,
} from './dtos/token-list-info.dto';
import { environment } from '../../../environments/environment';
import { ListingInfoResponse } from './dtos/listing-info-response.dto';
import { OperationDetailsResponse } from './dtos/operation-details-response';

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

  getTokenInfo(ticker: string): Observable<GetTokenInfoResponse> {
    const url = `${this.baseurl}/krc20/token/${ticker}`;

    return this.httpClient.get<GetTokenInfoResponse>(url);
  }

  getListingInfo(
    ticker: string,
    walletAddress?: string,
    txid?: string
  ): Observable<ListingInfoResponse> {
    const url = `${this.baseurl}/krc20/market/${ticker}`;

    const params: { address?: string; txid?: string } = {};

    if (walletAddress) {
      params.address = walletAddress;
    }

    if (txid) {
      params.txid = txid;
    }

    return this.httpClient.get<ListingInfoResponse>(url, { params });
  }

  getOperationDetails(
    operationTransactionId: string,
  ): Observable<OperationDetailsResponse> {
    const url = `${this.baseurl}/krc20/op/${operationTransactionId}`;

    return this.httpClient.get<OperationDetailsResponse>(url);
  }

  async isListingStillExists(
    ticker: string,
    walletAddress: string,
    txid: string
  ): Promise<boolean> {
    const result = await firstValueFrom(
      this.getListingInfo(ticker, walletAddress, txid)
    );

    if (result.message != 'successful') {
      console.error(
        `Error fetching token info for ${ticker} at address ${walletAddress}:`,
        result
      );
      throw new Error(result.message);
    }

    return result.result.length > 0;
  }

}
