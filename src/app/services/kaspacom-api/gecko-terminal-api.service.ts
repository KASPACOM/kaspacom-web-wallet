import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  GeckoOhlcvEntry,
  GeckoOhlcvResponse,
  GeckoTokenPool,
  GeckoTokenPoolsResponse,
  TokenPriceChangeStats,
} from './dtos/gecko-terminal.interface';

@Injectable({ providedIn: 'root' })
export class GeckoTerminalApiService {
  private readonly BASE_URL = 'https://api.geckoterminal.com/api/v2';

  constructor(private readonly httpClient: HttpClient) {}

  async getTopPoolsForToken(
    network: string,
    tokenAddress: string,
  ): Promise<GeckoTokenPool[]> {
    const params = new HttpParams().set('page', '1');
    const response = await firstValueFrom(
      this.httpClient.get<GeckoTokenPoolsResponse>(
        `${this.BASE_URL}/networks/${network}/tokens/${tokenAddress}/pools`,
        { params },
      ),
    );
    return (response?.data ?? []).map((item) => ({
      address: item.attributes.address,
      name: item.attributes.name,
      reserveInUsd: item.attributes.reserve_in_usd,
      baseTokenPriceUsd: item.attributes.base_token_price_usd,
      priceChangeH24: item.attributes.price_change_percentage?.h24 ?? null,
    }));
  }

  async getPoolOhlcv(
    network: string,
    poolAddress: string,
    timeframe: 'day' | 'hour' | 'minute',
    aggregate = 1,
    limit = 30,
  ): Promise<GeckoOhlcvEntry[]> {
    const params = new HttpParams()
      .set('aggregate', aggregate.toString())
      .set('limit', limit.toString())
      .set('currency', 'usd');

    const response = await firstValueFrom(
      this.httpClient.get<GeckoOhlcvResponse>(
        `${this.BASE_URL}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`,
        { params },
      ),
    );

    return (response?.data?.attributes?.ohlcv_list ?? []).map(
      ([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      }),
    );
  }

  async getPriceChangeStats(
    network: string,
    poolAddress: string,
  ): Promise<TokenPriceChangeStats> {
    const [dailyCandles, weeklyCandles, monthlyCandles] = await Promise.all([
      this.getPoolOhlcv(network, poolAddress, 'day', 1, 2).catch(() => []),
      this.getPoolOhlcv(network, poolAddress, 'day', 1, 8).catch(() => []),
      this.getPoolOhlcv(network, poolAddress, 'day', 1, 31).catch(() => []),
    ]);

    return {
      h24: this.calcPriceChange(dailyCandles, 1),
      d7: this.calcPriceChange(weeklyCandles, 7),
      d30: this.calcPriceChange(monthlyCandles, 30),
    };
  }

  private calcPriceChange(candles: GeckoOhlcvEntry[], periods: number): number | null {
    if (candles.length < 2) return null;
    const newest = candles[candles.length - 1];
    const oldest = candles[Math.max(0, candles.length - 1 - periods)];
    if (!oldest.open || oldest.open === 0) return null;
    return ((newest.close - oldest.open) / oldest.open) * 100;
  }
}
