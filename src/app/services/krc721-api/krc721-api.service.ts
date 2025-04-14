import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { StatusResponse } from './model/status-response.interface';
import { CollectionListResponse } from './model/collection-list-response.interface';
import { CollectionDataResponse } from './model/collection-data-response.interface';
import { TokenDetailsResponse } from './model/token-details-response.intereface';
import { TokenOwnersResponse } from './model/token-owners-response.interface';
import { WalletAddressTokensResponse } from './model/wallet-address-tokens-response.interface';
import { WalletAddressCollectionTokensResponse } from './model/wallet-address-collection-tokens-response.interface';
import { OperationDetailsResponse } from './model/operation-details-response.interface';
import { TokenHistoryDirection } from './model/token-history-direction.enum';
import { TokenHistoryResponse } from './model/token-history-response.interface';

@Injectable({
  providedIn: 'root'
})
export class Krc721ApiService {
  private readonly apiUrl: string;

  constructor(private http: HttpClient) {
    this.apiUrl = environment.krc721Api;
  }

  getStatus(): Observable<StatusResponse> {
    return this.http.get<StatusResponse>(`${this.apiUrl}/status`);
  }

  getAllNftCollections(offset?: number): Observable<CollectionListResponse> {
    let params = new HttpParams();
    if (offset !== undefined) {
      params = params.set('offset', offset.toString());
    }
    return this.http.get<CollectionListResponse>(`${this.apiUrl}/nfts`, { params });
  }

  getNftCollectionDetails(ticker: string): Observable<CollectionDataResponse> {
    return this.http.get<CollectionDataResponse>(`${this.apiUrl}/nfts/${ticker}`);
  }

  getTokenDetails(ticker: string, tokenId: string): Observable<TokenDetailsResponse> {
    return this.http.get<TokenDetailsResponse>(`${this.apiUrl}/nfts/${ticker}/${tokenId}`);
  }

  getTokenOwners(ticker: string, offset?: number): Observable<TokenOwnersResponse> {
    let params = new HttpParams();
    if (offset !== undefined) {
      params = params.set('offset', offset.toString());
    }
    return this.http.get<TokenOwnersResponse>(`${this.apiUrl}/owners/${ticker}`, { params });
  }

  getWalletAddressTokens(address: string, offset?: string): Observable<WalletAddressTokensResponse> {
    let params = new HttpParams();
    if (offset) {
      params = params.set('offset', offset);
    }
    return this.http.get<WalletAddressTokensResponse>(`${this.apiUrl}/address/${address}`, { params });
  }

  getWalletAddressCollectionTokens(
    address: string,
    ticker: string,
    offset?: number
  ): Observable<WalletAddressCollectionTokensResponse> {
    let params = new HttpParams();
    if (offset !== undefined) {
      params = params.set('offset', offset.toString());
    }
    return this.http.get<WalletAddressCollectionTokensResponse>(`${this.apiUrl}/address/${address}/${ticker}`, { params });
  }

  getOperationDetailsByTransactionId(txId: string): Observable<OperationDetailsResponse> {
    return this.http.get<OperationDetailsResponse>(`${this.apiUrl}/ops/txid/${txId}`);
  }

  getTokenHistory(
    ticker: string,
    tokenId: string,
    options?: {
      offset?: number;
      direction?: TokenHistoryDirection;
    }
  ): Observable<TokenHistoryResponse> {
    let params = new HttpParams();
    if (options?.offset !== undefined) {
      params = params.set('offset', options.offset.toString());
    }
    if (options?.direction) {
      params = params.set('direction', options.direction);
    }
    return this.http.get<TokenHistoryResponse>(`${this.apiUrl}/history/${ticker}/${tokenId}`, { params });
  }
}
