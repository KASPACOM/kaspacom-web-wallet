import { inject, Injectable } from '@angular/core';
import { ZeroAddress } from 'ethers';
import { LfgTokensCacheService } from '../lfg-tokens-cache-service/lfg-tokens-cache.service';
import { LfgToken } from '../../types/lfg-token.model';
import { ImageService } from '../image-service/image.service';
import { LOGOS_URL } from '../../config/injection-tokens';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  private readonly imageService = inject(ImageService);
  private readonly lfgTokensCacheService = inject(LfgTokensCacheService);
  private readonly logosUrl = inject(LOGOS_URL);
  //private readonly defiBackendApiService = inject(DefiBackendApiService);
  private readonly imageUrlCache = new Map<
    string,
    { url: string; timestamp: number }
  >();
  private readonly pendingRequests = new Map<string, Promise<string>>();
  private readonly IMG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly availableLocalTokensLogos = new Set([
    'DAI',
    'KAS',
    'USDC',
    'WBTC',
    'WETH',
    'WKAS',
    'USDT',
  ]);
  async checkLogoImageUrl(
    address: string,
    ticker: string,
    isMetamask = false,
  ): Promise<string> {
    const cacheKey = `${address.toLowerCase()}-${ticker.toUpperCase()}`;

    // Check cache first
    const cached = this.imageUrlCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < this.IMG_CACHE_DURATION &&
      !isMetamask
    ) {
      return Promise.resolve(cached.url);
    }

    // Check if there's already a pending request for this logo
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create and store the fetch promise
    const fetchPromise = this.fetchLogoUrl(
      address,
      ticker,
      isMetamask,
      cacheKey,
    );
    this.pendingRequests.set(cacheKey, fetchPromise);

    // Clean up pending request after completion (success or failure)
    fetchPromise.finally(() => {
      this.pendingRequests.delete(cacheKey);
    });

    return fetchPromise;
  }

  private async fetchLogoUrl(
    address: string,
    ticker: string,
    isMetamask: boolean,
    cacheKey: string,
  ): Promise<string> {
    let lfgTokens: LfgToken[] = [];
    try {
      const data = await this.lfgTokensCacheService.getAllTokens();
      lfgTokens = data?.tokens || [];
    } catch {
      // Silently skip errors
      lfgTokens = [];
    }

    if (address === ZeroAddress) {
      ticker = 'KAS';
    }

    let lfgTokenUrl = '';

    // Try to find logo in LFG tokens array
    if (lfgTokens && lfgTokens.length > 0) {
      const lfgToken = lfgTokens.find(
        (token) => token.address.toLowerCase() === address.toLowerCase(),
      );
      if (lfgToken?.logoURI) {
        lfgTokenUrl = lfgToken.logoURI;
      }
    }
    const defaultUrl = isMetamask
      ? `https://erc20-logo-dev.s3.eu-central-1.amazonaws.com/0x9b9e99f875f2c03051546d494e3f49cc1d878acc.png`
      : '';

    const addressUrl = `${this.logosUrl}${address.toLowerCase()}.png`;
    let logoUrl = '';
    try {
      const response = await firstValueFrom(
        this.imageService.getLogoUrl(address),
      );
      // Defensive: backend might return an empty/partial payload.
      logoUrl = response?.logoURI ?? '';
    } catch {
      console.error('logo not found for address', address);
    }
    const fallbackUrl = './images/kc-all-black.png';
    const localUrl = this.availableLocalTokensLogos.has(ticker.toUpperCase())
      ? `./images/tokens-logos/${ticker.toUpperCase()}.png`
      : '';
    const test = (url: string) =>
      new Promise<string>((res) => {
        if (!url) return res('');
        const img = new Image();
        img.onload = () => res(url);
        img.onerror = () => res('');
        img.src = url;
      });

    return (
      test(localUrl)
        //.then((r) => r || test(logoUrl)) //backend
        .then((r) => r || test(lfgTokenUrl))
        .then((r) => r || test(addressUrl)) //s3
        .then((r) => r || test(defaultUrl)) //default logo for metamask
        .then((r) => r || fallbackUrl) // fallback logo
        .then((finalUrl) => {
          if (finalUrl !== fallbackUrl) {
            this.imageUrlCache.set(cacheKey, {
              url: finalUrl,
              timestamp: Date.now(),
            });
          }
          return finalUrl;
        })
    );
  }
}
