import { Injectable } from '@angular/core';
import { HttpClient, } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Krc20PortfolioResponse } from './dtos/krc20-prortfolio';

@Injectable({ providedIn: 'root' })
export class KaspaComApiService {
  baseurl = environment.kaspaComApiBaseurl;

  constructor(private readonly httpClient: HttpClient) { }


  async getTokensPrices(
    tickers: string[]
  ): Promise<Krc20PortfolioResponse> {
    if (tickers.length === 0) return [];

    const url = `${this.baseurl}/krc20/portfolio?tickers=${tickers.map(ticker => encodeURIComponent(ticker.toUpperCase())).join(',')}`;
    return (await firstValueFrom(this.httpClient.get<Krc20PortfolioResponse>(url)));
  }
}
