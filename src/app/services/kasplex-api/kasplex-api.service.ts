import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { GetTokenWalletInfoResponse } from './dtos/get-token-wallet-info-response.dto';
import {
  GetTokenInfoResponse,
  GetTokenListResponse,
} from './dtos/token-list-info.dto';
import { environment } from '../../../environments/environment';
import { ListingInfoResponse } from './dtos/listing-info-response.dto';
import { OperationDetailsResponse } from './dtos/operation-details-response';
import { GetWalletOperationsResponse } from './dtos/get-wallet-operations-response.dto';

@Injectable({ providedIn: 'root' })
export class KasplexKrc20Service {
  baseurl = environment.kasplexApiBaseurl;

  constructor(private readonly httpClient: HttpClient) {}

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

    return this.httpClient.get<GetTokenListResponse>(url)
  }

  getTokenWalletBalanceInfo(
    address: string,
    ticker: string
  ): Observable<GetTokenWalletInfoResponse> {
    const url = `${this.baseurl}/krc20/address/${address}/token/${ticker}`;
    return this.httpClient.get<GetTokenWalletInfoResponse>(url);
  }

  getWalletOperationHistory(
    address: string,
    ticker?: string,
  ): Observable<GetWalletOperationsResponse> {

    const url = `${this.baseurl}/krc20/oplist`;

    const params: { address: string; tick?: string } = { address };

    if (ticker) {
      params.tick = ticker;
    }

    return this.httpClient.get<GetWalletOperationsResponse>(url, { params });
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
    operationTransactionId: string
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
