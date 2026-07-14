import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEFI_API_BASE_URL } from '../../config/injection-tokens';
import { LfgToken, LfgTokenResponse } from '../../types/lfg-token.model';
import { ImageService } from '../image-service/image.service';

/**
 * LFG Tokens Cache Service
 *
 * Caches the LFG tokens response from backend API to avoid repeated API calls.
 * The backend proxies https://api.lfg.kaspa.com/tokens/dex to avoid CORS issues.
 * Provides efficient token lookup by address with case-insensitive matching.
 *
 * Features:
 * - Automatic cache initialization on first request
 * - Fast token lookup by address using Map
 * - Cache expiry after 5 minutes
 * - Manual refresh capability
 */
@Injectable({
  providedIn: 'root',
})
export class LfgTokensCacheService {
  private baseUrl = inject(DEFI_API_BASE_URL);

  private readonly imageService = inject(ImageService);
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly ERROR_BACKOFF_MS = 30 * 1000; // 30 seconds before retrying after a failure

  private cacheLoadedPromise: Promise<LfgTokenResponse> | undefined = undefined;

  private tokensCache = new Map<string, LfgToken>();
  private cacheTimestamp: number | null = null;
  private errorBackoffUntil = 0;
  private responseCache = signal<LfgTokenResponse | null>(null);

  /**
   * Get all tokens from the LFG API
   * Returns cached response if available and not expired
   */
  async getAllTokens(
    skipCacheRefresh?: boolean,
  ): Promise<LfgTokenResponse | null> {
    if (this.isCacheValid()) {
      return this.responseCache();
    }

    if (skipCacheRefresh && this.cacheTimestamp && this.responseCache()) {
      return this.responseCache();
    }

    return await this.refreshCache();
  }

  /**
   * Find a token by its address (case-insensitive)
   * @param address Token contract address
   * @returns LfgToken or null if not found
   */
  async getTokenByAddress(address: string): Promise<LfgToken | null> {
    await this.getAllTokens();
    const normalizedAddress = address.toLowerCase();
    return this.tokensCache.get(normalizedAddress) || null;
  }

  /**
   * Find multiple tokens by their addresses
   * @param addresses Array of token contract addresses
   * @returns Array of found tokens (excludes not found tokens)
   */
  async getTokensByAddresses(addresses: string[]): Promise<LfgToken[]> {
    await this.getAllTokens();

    return addresses
      .map((addr) => this.tokensCache.get(addr.toLowerCase()))
      .filter((token): token is LfgToken => token !== undefined);
  }

  /**
   * Manually refresh the cache from the backend API
   */
  protected async refreshCache(): Promise<LfgTokenResponse> {
    if (this.cacheLoadedPromise) {
      return await this.cacheLoadedPromise;
    }

    if (Date.now() < this.errorBackoffUntil && this.responseCache()) {
      // Recent failure; serve the previous (possibly empty) response
      // instead of stampeding the backend with retries.
      return this.responseCache()!;
    }

    this.cacheLoadedPromise = new Promise<LfgTokenResponse>((resolve) => {
      (async () => {
        try {
          const response = await firstValueFrom<LfgTokenResponse>(
            this.imageService.getLfgTokens(),
          );

          // Update cache
          this.responseCache.set(response);
          this.cacheTimestamp = Date.now();
          this.errorBackoffUntil = 0;

          // Rebuild token lookup map
          this.tokensCache.clear();
          response?.tokens?.forEach((token) => {
            this.tokensCache.set(token.address.toLowerCase(), token);
          });

          resolve(response);
        } catch (error) {
          console.error('Failed to fetch LFG tokens from backend:', error);
          this.errorBackoffUntil = Date.now() + this.ERROR_BACKOFF_MS;
          // Return empty response to prevent failures downstream
          const emptyResponse: LfgTokenResponse = {
            name: '',
            timestamp: new Date().toISOString(),
            version: { major: 0, minor: 0, patch: 0 },
            tags: {},
            logoURI: '',
            keywords: [],
            tokens: [],
          };
          if (!this.responseCache()) {
            this.responseCache.set(emptyResponse);
          }
          resolve(emptyResponse);
        }
      })();
    });

    return await this.cacheLoadedPromise.finally(() => {
      this.cacheLoadedPromise = undefined;
    });
  }

  /**
   * Check if cache is valid (exists and not expired)
   */
  private isCacheValid(): boolean {
    if (!this.cacheTimestamp || !this.responseCache()) {
      return false;
    }

    const age = Date.now() - this.cacheTimestamp;
    return age < this.CACHE_DURATION_MS;
  }

  /**
   * Clear the cache manually
   */
  clearCache(): void {
    this.tokensCache.clear();
    this.responseCache.set(null);
    this.cacheTimestamp = null;
    this.errorBackoffUntil = 0;
    this.cacheLoadedPromise = undefined;
  }

  async searchTokens(searchTerm: string): Promise<LfgToken[]> {
    await this.getAllTokens(true);
    const lowerSearchTerm = searchTerm.toLowerCase();

    return Array.from(this.tokensCache.values()).filter((token) => {
      return (
        token.symbol.toLowerCase().includes(lowerSearchTerm) ||
        token.name.toLowerCase().includes(lowerSearchTerm) ||
        token.address.toLowerCase().includes(lowerSearchTerm)
      );
    });
  }
}
