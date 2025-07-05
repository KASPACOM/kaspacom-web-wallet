import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Krc721Collection, 
  Krc721CollectionResponse, 
  Krc721CollectionsResponse 
} from './dtos/krc721-collection.dto';
import { 
  Krc721Nft, 
  Krc721NftResponse, 
  Krc721NftsResponse, 
  Krc721TokenOwner, 
  Krc721TokenOwnersResponse 
} from './dtos/krc721-nft.dto';
import { 
  Krc721Operation, 
  Krc721OperationsResponse 
} from './dtos/krc721-operations.dto';

@Injectable({ providedIn: 'root' })
export class Krc721ApiService {
  private baseUrl = environment.krc721ApiBaseurl;

  constructor(private readonly httpClient: HttpClient) {}

  // Collections
  getCollections(
    offset: number = 0,
    limit: number = 50,
    direction: 'forward' | 'backward' = 'forward'
  ): Observable<Krc721CollectionsResponse> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString())
      .set('direction', direction);

    return this.httpClient
      .get<Krc721CollectionsResponse>(`${this.baseUrl}/nfts`, { params })
      .pipe(
        catchError((error) => {
          console.error('Error fetching collections:', error);
          return of({ message: 'error', result: [] });
        })
      );
  }

  getCollectionDetails(tick: string): Observable<Krc721CollectionResponse> {
    return this.httpClient
      .get<Krc721CollectionResponse>(`${this.baseUrl}/nfts/${tick}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching collection details for ${tick}:`, error);
          return of({ message: 'error', result: null as any });
        })
      );
  }

  // NFTs / Tokens
  getTokenDetails(tick: string, tokenId: string): Observable<Krc721NftResponse> {
    return this.httpClient
      .get<Krc721NftResponse>(`${this.baseUrl}/nfts/${tick}/${tokenId}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching token details for ${tick}/${tokenId}:`, error);
          return of({ message: 'error', result: null as any });
        })
      );
  }

  // Address Holdings
  getAddressNfts(
    address: string,
    offset?: number,
    limit?: number,
    direction: 'forward' | 'backward' = 'forward'
  ): Observable<Krc721NftsResponse> {
    let params = new HttpParams();
    if (offset !== undefined) params = params.set('offset', offset.toString());
    if (limit !== undefined) params = params.set('limit', limit.toString());
    params = params.set('direction', direction);

    return this.httpClient
      .get<Krc721NftsResponse>(`${this.baseUrl}/address/${address}`, { params })
      .pipe(
        catchError((error) => {
          console.error(`Error fetching NFTs for address ${address}:`, error);
          return of({ message: 'error', result: [] });
        })
      );
  }

  getAddressCollectionHoldings(
    address: string,
    tick: string
  ): Observable<Krc721NftsResponse> {
    return this.httpClient
      .get<Krc721NftsResponse>(`${this.baseUrl}/address/${address}/${tick}`)
      .pipe(
        catchError((error) => {
          console.error(
            `Error fetching holdings for address ${address} and collection ${tick}:`,
            error
          );
          return of({ message: 'error', result: [] });
        })
      );
  }

  // Token Owners
  getTokenOwners(
    tick: string,
    offset?: number,
    limit?: number
  ): Observable<Krc721TokenOwnersResponse> {
    let params = new HttpParams();
    if (offset !== undefined) params = params.set('offset', offset.toString());
    if (limit !== undefined) params = params.set('limit', limit.toString());

    return this.httpClient
      .get<Krc721TokenOwnersResponse>(`${this.baseUrl}/owners/${tick}`, { params })
      .pipe(
        catchError((error) => {
          console.error(`Error fetching token owners for ${tick}:`, error);
          return throwError(error);
        })
      );
  }

  // Operations
  getOperations(
    offset?: string,
    direction: 'forward' | 'backward' = 'forward'
  ): Observable<Krc721OperationsResponse> {
    let params = new HttpParams();
    if (offset) params = params.set('offset', offset);
    params = params.set('direction', direction);

    return this.httpClient
      .get<Krc721OperationsResponse>(`${this.baseUrl}/ops`, { params })
      .pipe(
        catchError((error) => {
          console.error('Error fetching operations:', error);
          return of({ message: 'error', result: [] });
        })
      );
  }

  getOperationByScore(score: string): Observable<{ message: string; result: Krc721Operation }> {
    return this.httpClient
      .get<{ message: string; result: Krc721Operation }>(`${this.baseUrl}/ops/score/${score}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching operation by score ${score}:`, error);
          return of({ message: 'error', result: null as any });
        })
      );
  }

  getOperationByTxId(txId: string): Observable<{ message: string; result: Krc721Operation }> {
    return this.httpClient
      .get<{ message: string; result: Krc721Operation }>(`${this.baseUrl}/ops/txid/${txId}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching operation by txId ${txId}:`, error);
          return of({ message: 'error', result: null as any });
        })
      );
  }

  // Royalties
  getRoyaltyFees(
    address: string,
    tick: string
  ): Observable<{ message: string; result: string }> {
    return this.httpClient
      .get<{ message: string; result: string }>(`${this.baseUrl}/royalties/${address}/${tick}`)
      .pipe(
        catchError((error) => {
          console.error(
            `Error fetching royalty fees for address ${address} and collection ${tick}:`,
            error
          );
          return of({ message: 'error', result: '0' });
        })
      );
  }

  // Rejection Reasons
  getRejectionReason(
    txId: string
  ): Observable<{ message: string; result: string }> {
    return this.httpClient
      .get<{ message: string; result: string }>(`${this.baseUrl}/rejections/txid/${txId}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching rejection reason for txId ${txId}:`, error);
          return of({ message: 'error', result: '' });
        })
      );
  }

  // Ownership History
  getOwnershipHistory(
    tick: string,
    tokenId: string,
    offset?: string
  ): Observable<Krc721TokenOwnersResponse> {
    let params = new HttpParams();
    if (offset) params = params.set('offset', offset);

    return this.httpClient
      .get<Krc721TokenOwnersResponse>(`${this.baseUrl}/history/${tick}/${tokenId}`, { params })
      .pipe(
        catchError((error) => {
          console.error(
            `Error fetching ownership history for ${tick}/${tokenId}:`,
            error
          );
          return of({ message: 'error', result: [] });
        })
      );
  }

  // Utility methods
  async getWalletNftCollections(address: string): Promise<string[]> {
    try {
      const response = await this.getAddressNfts(address).toPromise();
      if (response?.message === 'success' && response.result) {
        const collections = new Set(response.result.map(nft => nft.tick));
        return Array.from(collections);
      }
      return [];
    } catch (error) {
      console.error('Error fetching wallet NFT collections:', error);
      return [];
    }
  }

  async getWalletNftsByCollection(address: string, tick: string): Promise<Krc721Nft[]> {
    try {
      const response = await this.getAddressCollectionHoldings(address, tick).toPromise();
      if (response?.message === 'success' && response.result) {
        return response.result;
      }
      return [];
    } catch (error) {
      console.error('Error fetching wallet NFTs by collection:', error);
      return [];
    }
  }
}