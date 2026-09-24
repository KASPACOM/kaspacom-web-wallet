import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export interface WalletProviderTokenMetadataDto {
  covenantId: string;
  name?: string | null;
  ticker?: string | null;
  logoUrl?: string | null;
  metadataSource?: string | null;
  metadataVerificationStatus?: string | null;
  decimals?: number | null;
  /** Base-unit scale for one display token; balance amounts are in base units. */
  tokenDisplayScale?: string | null;
}

export interface WalletProviderNativeBalanceDto {
  amount: string;
  utxoCount: number;
  transferable: boolean;
  wrappable: boolean;
}

export interface WalletProviderWrappedBalanceDto {
  wrappedMarketId?: string | null;
  amount: string;
  utxoCount: number;
  transferable: boolean;
  tradeable: boolean;
  unwrapSupported: boolean;
}

export interface WalletProviderTokenBalanceDto {
  canonicalCovenantId: string;
  token: WalletProviderTokenMetadataDto;
  nativeBalance: WalletProviderNativeBalanceDto;
  wrappedBalance: WalletProviderWrappedBalanceDto;
  lastChangeMs?: number | null;
}

interface WalletProviderBalancesResponseDto {
  ownerIdentifier: string;
  items: WalletProviderTokenBalanceDto[];
  total: number;
  limit: number;
  offset: number;
  generatedAtMs: number;
}

/**
 * Wallet-facing KCC20 balances (dev-api-kcc20 `/wallet-provider/owners/:owner/balances`),
 * grouped by canonical token with native/wrapped amounts and metadata already
 * attached — a 10s-cached alternative to reconstructing balances by decoding
 * covenant indexer UTXOs.
 */
@Injectable({ providedIn: 'root' })
export class Kcc20WalletBalancesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  async getOwnerBalances(
    owner: string,
  ): Promise<WalletProviderTokenBalanceDto[]> {
    const response = await firstValueFrom(
      this.httpClient.get<WalletProviderBalancesResponseDto>(
        `${this.baseUrl}/wallet-provider/owners/${owner}/balances`,
        { params: new HttpParams().set('hasBalance', 'true').set('limit', 500) },
      ),
    );
    return response.items || [];
  }

  private get baseUrl(): string {
    const baseUrl = this.kaspaL1NetworkService.getKcc20ApiBaseurl();
    if (!baseUrl) {
      throw new Error('KCC20 is not available on this network.');
    }
    return baseUrl.replace(/\/+$/, '');
  }
}
