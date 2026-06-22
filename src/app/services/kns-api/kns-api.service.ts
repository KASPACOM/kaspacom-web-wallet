import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map, throwError } from 'rxjs';
import {
  KnsDomainAsset,
  KnsDomainsResponse,
  KnsDomainResponse,
  KnsDomainOwnerInfo,
  KnsDomainOwnerResponse,
  KnsDomainCheckRequest,
  KnsDomainCheckResponse,
  KnsWalletAssetsStatus,
  KnsDomainCollection
} from './dtos/kns-domain.dto';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

@Injectable({ providedIn: 'root' })
export class KnsApiService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly kaspaL1NetworkService: KaspaL1NetworkService,
  ) {}

  private get baseUrl(): string | undefined {
    return this.kaspaL1NetworkService.getKnsApiBaseurl();
  }

  private emptyDomainsResponse(page = 1, pageSize = 20): KnsDomainsResponse {
    return {
      data: {
        assets: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: pageSize,
        },
      },
    };
  }

  /**
   * Fetch asset details by asset ID
   */
  fetchAssetByAssetId(assetId: string): Observable<KnsDomainResponse> {
    if (!this.baseUrl) {
      return throwError(
        () => new Error('KNS is not supported on the current network'),
      );
    }

    return this.httpClient
      .get<KnsDomainResponse>(`${this.baseUrl}/api/v1/asset/${assetId}/detail`)
      .pipe(
        catchError((error) => {
          // Only a 404 means "asset not found"; surface other failures
          // (transient 5xx/network) so callers' try/catch can distinguish an
          // API error from a missing asset.
          if (error?.status === 404) {
            return of({ data: null as any });
          }
          console.error(`Error fetching asset by ID ${assetId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Fetch assets by owner
   */
  fetchAssetsByOwner(
    owner: string,
    page: number = 1,
    pageSize: number = 20,
    asset?: string,
    status?: KnsWalletAssetsStatus
  ): Observable<KnsDomainsResponse> {
    if (!this.baseUrl) {
      return of(this.emptyDomainsResponse(page, pageSize));
    }

    if (pageSize > 100) {
      throw new Error('Max page size is 100');
    }

    let params = new HttpParams()
      .set('owner', owner)
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (asset) {
      params = params.set('asset', asset);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.httpClient
      .get<KnsDomainsResponse>(`${this.baseUrl}/api/v1/assets`, { params })
      .pipe(
        catchError((error) => {
          console.error(`Error fetching assets by owner ${owner}:`, error);
          return of({
            data: {
              assets: [],
              pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: pageSize
              }
            }
          });
        })
      );
  }

  /**
   * Fetch all assets with filtering options
   */
  fetchAssets(
    page: number,
    pageSize: number,
    status?: 'default' | 'listed' | undefined,
    sortOrder?: 'asc' | 'desc',
    collection?: KnsDomainCollection,
    asset?: string,
    owner?: string
  ): Observable<KnsDomainsResponse> {
    if (!this.baseUrl) {
      return of(this.emptyDomainsResponse(page, pageSize));
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString())
      .set('type', 'domain');

    if (collection) {
      params = params.set('collection', collection);
    }
    if (asset) {
      params = params.set('asset', asset);
    }
    if (sortOrder) {
      params = params.set('sortOrder', sortOrder.toUpperCase());
    }
    if (owner) {
      params = params.set('owner', owner);
    }
    if (status) {
      params = params.set('status', status);
    }

    return this.httpClient
      .get<KnsDomainsResponse>(`${this.baseUrl}/api/v1/assets`, { params })
      .pipe(
        catchError((error) => {
          console.error('Error fetching assets:', error);
          return of({
            data: {
              assets: [],
              pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: pageSize
              }
            }
          });
        })
      );
  }
  /**
   * Fetch domain information by domain name
   * Expects domain to be URL-encoded as per KNS documentation requirements
   */
  fetchDomainInfo(domain: string): Observable<KnsDomainAsset | undefined> {
    if (!this.baseUrl) {
      return of(undefined);
    }

    // Decode the domain to get the original form for comparison
    const decodedDomain = decodeURIComponent(domain);
    const decodedDomainWithoutSuffix = decodedDomain.replace('.kas', '');

    // Use the URL-encoded domain name (without suffix) in the API call
    const encodedDomainWithoutSuffix = encodeURIComponent(decodedDomainWithoutSuffix);

    return this.httpClient
      .get<KnsDomainsResponse>(`${this.baseUrl}/api/v1/assets?asset=${encodedDomainWithoutSuffix}`)
      .pipe(
        map((response) => {
          return response.data.assets.find(
            (asset) => asset.asset === decodedDomain
          );
        }),
        catchError((error) => {
          console.error(`Error fetching domain info for ${decodedDomain}:`, error);
          return of(undefined);
        })
      );
  }

  /**
   * Update domain text records
   */
  updateDomainText(
    assetId: string,
    textRecords: { [key: string]: string }
  ): Observable<{ success: boolean; message?: string }> {
    if (!this.baseUrl) {
      return of({ success: false, message: 'KNS is not supported on the selected network' });
    }

    return this.httpClient
      .post<{ success: boolean; message?: string }>(
        `${this.baseUrl}/api/v1/asset/${assetId}/text`,
        { text: textRecords }
      )
      .pipe(
        catchError((error) => {
          console.error(`Error updating domain text for ${assetId}:`, error);
          return of({ success: false, message: 'Failed to update domain text' });
        })
      );
  }

  /**
   * Transfer domain ownership
   */
  transferDomain(
    assetId: string,
    toAddress: string
  ): Observable<{ success: boolean; txId?: string; message?: string }> {
    if (!this.baseUrl) {
      return of({ success: false, message: 'KNS is not supported on the selected network' });
    }

    return this.httpClient
      .post<{ success: boolean; txId?: string; message?: string }>(
        `${this.baseUrl}/api/v1/asset/${assetId}/transfer`,
        { to: toAddress }
      )
      .pipe(
        catchError((error) => {
          console.error(`Error transferring domain ${assetId}:`, error);
          return of({ success: false, message: 'Failed to transfer domain' });
        })
      );
  }

  /**
   * Get wallet's total domain count
   */
  async getWalletDomainCount(walletAddress: string): Promise<number> {
    try {
      const response = await this.fetchAssetsByOwner(walletAddress, 1, 1).toPromise();
      return response?.data.pagination.totalItems || 0;
    } catch (error) {
      console.error('Error fetching wallet domain count:', error);
      return 0;
    }
  }

  /**
   * Get all domains owned by wallet (paginated)
   */
  async getAllWalletDomains(walletAddress: string): Promise<KnsDomainAsset[]> {
    try {
      // First get total count
      const firstPage = await this.fetchAssetsByOwner(walletAddress, 1, 100).toPromise();
      if (!firstPage?.data.assets.length) {
        return [];
      }

      const allDomains = [...firstPage.data.assets];
      const totalPages = firstPage.data.pagination.totalPages;

      // Fetch remaining pages if needed
      for (let page = 2; page <= totalPages; page++) {
        const pageResponse = await this.fetchAssetsByOwner(walletAddress, page, 100).toPromise();
        if (pageResponse?.data.assets) {
          allDomains.push(...pageResponse.data.assets);
        }
      }

      return allDomains;
    } catch (error) {
      console.error('Error fetching all wallet domains:', error);
      return [];
    }
  }

  /**
   * Search domains by pattern
   */
  searchDomains(
    searchTerm: string,
    page: number = 1,
    pageSize: number = 20
  ): Observable<KnsDomainsResponse> {
    return this.fetchAssets(page, pageSize, undefined, undefined, undefined, searchTerm);
  }
}
