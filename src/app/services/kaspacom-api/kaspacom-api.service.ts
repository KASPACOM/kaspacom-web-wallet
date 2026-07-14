import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Krc20PortfolioResponse } from './dtos/krc20-prortfolio';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export type TokenLogoResult = { ticker: string; logo: string };
export type TokenLogosResult = TokenLogoResult[];

@Injectable({ providedIn: 'root' })
export class KaspaComApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  get baseurl(): string {
    return this.kaspaL1NetworkService.getKaspaComApiBaseurl();
  }

  async getTokensPrices(tickers: string[]): Promise<Krc20PortfolioResponse> {
    if (tickers.length === 0) return [];

    const url = `${this.baseurl}/krc20/portfolio?tickers=${tickers.map((ticker) => encodeURIComponent(ticker.toUpperCase())).join(',')}`;
    return await firstValueFrom(
      this.httpClient.get<Krc20PortfolioResponse>(url),
    );
  }

  async getTokensLogosUrl(ticker?: string): Promise<TokenLogosResult> {
    let url = `${this.baseurl}/api/tokens-logos`;

    if (ticker) {
      url += `?ticker=${ticker.toUpperCase()}`;
    }

    return await firstValueFrom(this.httpClient.get<TokenLogosResult>(url));
  }
}
