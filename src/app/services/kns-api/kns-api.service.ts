import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { KnsWalletAssetsParams } from './model/kns-wallet-assets-params.interface';
import { KnsAssetDetailResponse, KnsWalletAssetsResponse } from './model/kns-wallet-assets-response.interface';
import { KnsDomainOwnerResponse } from './model/kns-domain-owner-response.interface';
import { KnsDomainCheckResponse } from './model/kns-domain-check-response.interface';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class KnsApiService {
  baseurl = environment.knsApiBaseurl;

  constructor(private readonly httpClient: HttpClient) {}

  getKnsWalletAssets(walletAssetParams: KnsWalletAssetsParams): Observable<KnsWalletAssetsResponse> {
    if (walletAssetParams?.pageSize && walletAssetParams?.pageSize > 100) {
      throw new Error('pageSize cannot be greater than 100');
    }

    return this.httpClient.get<KnsWalletAssetsResponse>(`/assets`, { params: walletAssetParams as any as HttpParams });
  }

  getKnsAssetDetails(assetId: string): Observable<KnsAssetDetailResponse> {
    return this.httpClient.get<KnsAssetDetailResponse>(`asset/${assetId}/detail`);
  }

  getDomainOwner(domain: string): Observable<KnsDomainOwnerResponse> {
    return this.httpClient.get<KnsDomainOwnerResponse>(`/${domain}/owner`);
  }


  checkDomainAvailability(
    domains: string[],
    userWalletAddress: string
  ): Observable<KnsDomainCheckResponse> {
    return this.httpClient.post<KnsDomainCheckResponse>(
      `domains/check`,
      {
        address: userWalletAddress,
        domainNames: domains,
      }
    );
  }
}
