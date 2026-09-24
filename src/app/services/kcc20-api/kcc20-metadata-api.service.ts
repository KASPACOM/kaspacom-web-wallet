import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export interface Kcc20TokenMetadata {
  covenantId: string;
  tokenIdHex?: string;
  name?: string;
  ticker?: string;
  decimals?: number;
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  githubUrl?: string;
  mediumUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

/**
 * KCC20 token metadata (logos, links, description) is submitted by token
 * owners to the KCC20 product backend — it's not on-chain, so the covenant
 * indexer (used for balances) can't provide it. Metadata is optional per
 * token: most tokens have none yet, and requests fail closed (undefined)
 * on 404/network/CORS errors so a missing logo never surfaces as an error.
 */
@Injectable({ providedIn: 'root' })
export class Kcc20MetadataApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private get baseUrl(): string | undefined {
    return this.kaspaL1NetworkService.getKcc20ApiBaseurl();
  }

  async getMetadata(
    covenantId: string,
  ): Promise<Kcc20TokenMetadata | undefined> {
    const baseUrl = this.baseUrl;
    if (!baseUrl || !covenantId) return undefined;

    return firstValueFrom(
      this.httpClient
        .get<Kcc20TokenMetadata>(
          `${baseUrl.replace(/\/+$/, '')}/metadata/${covenantId}`,
        )
        .pipe(catchError(() => of(undefined))),
    );
  }

  async getLogoUrl(covenantId: string): Promise<string | undefined> {
    const metadata = await this.getMetadata(covenantId);
    return metadata?.logoUrl || undefined;
  }
}
