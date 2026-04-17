import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DexApiWalletToken } from './dtos/dex-api-wallet-tokens.interface';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';

export interface DexTokenSearchResult {
  id: string;
  name: string;
  symbol: string;
  decimals: string;
  derivedKAS?: string;
}

export interface MostTradedPairToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

export interface MostTradedPairResult {
  pair: {
    id: string;
    token0: MostTradedPairToken;
    token1: MostTradedPairToken;
  };
  amountKAS: string;
  swapCount: number;
}

// Raw shapes returned by the API — may differ from the normalized types above.
interface RawMostTradedToken {
  id?: string;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: string;
}

export interface MostTradedPairInfo {
  pair: MostTradedPair;
  amountKAS: string;
  swapCount: number;
}

export interface MostTradedPair {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
  };
}

export interface LfgSearchToken {
  tokenAddress: string;
  ticker: string;
  name: string;
  decimals: number;
  image?: string;
  state?: string;
}

const DEX_CONTROLLER = 'dex';
const TOKENS_CONTROLLER = 'tokens';
const EXPLORER_CONTROLLER = 'explorer';

@Injectable({ providedIn: 'root' })
export class KaspaComDefiApiService {
  baseurl = environment.kaspaComDefiApiBaseurl;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly ethereumWalletChainManager: EthereumWalletChainManager,
  ) {}

  private buildHttpParamsWithNetwork(params?: Record<string, any>): HttpParams {
    const config = this.ethereumWalletChainManager.getChainConfig(
      this.ethereumWalletChainManager.getCurrentChainSignal()()!,
    );
    const network = config?.defiApiNetworkName || config?.chainName;
    return this.buildHttpParams({ ...params, network });
  }

  private buildHttpParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return httpParams;
  }

  /**
   * GET /dex/wallet-tokens/:walletAddress
   * Get tokens of a wallet from backend
   */
  getWalletTokensBalances(walletAddress: string): Promise<DexApiWalletToken[]> {
    const params = this.buildHttpParamsWithNetwork();
    return firstValueFrom(
      this.httpClient.get<DexApiWalletToken[]>(
        `${this.baseurl}/${DEX_CONTROLLER}/wallet-tokens/${walletAddress}`,
        { params },
      ),
    );
  }

  /**
   * GET /tokens/search?searchTerm=...&first=...&skip=...&network=...
   * Search tokens by symbol, name, or address
   */
  searchDexTokens(
    searchTerm: string,
    options?: { first?: number; skip?: number },
  ): Promise<DexTokenSearchResult[]> {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return Promise.resolve([]);

    const params = this.buildHttpParamsWithNetwork({
      searchTerm: trimmedSearchTerm,
      first: options?.first ?? 100,
      skip: options?.skip ?? 0,
    });

    return firstValueFrom(
      this.httpClient
        .get<{
          tokens: DexTokenSearchResult[];
        }>(`${this.baseurl}/${TOKENS_CONTROLLER}/search`, { params })
        .pipe(
          map((response) => response?.tokens ?? []),
          catchError(() => of([])),
        ),
    );
  }

  /**
   * GET /dex/most-traded/pairs?network=...
   * Get most traded token pairs (used to populate token picker default list)
   */
  getMostTradedPairs(): Promise<MostTradedPairResult[]> {
    const minDate = Math.floor(Date.now() / 1000 - 24 * 60 * 60);
    const params = this.buildHttpParamsWithNetwork({ minDate });

    return firstValueFrom(
      this.httpClient
        .get<{
          pairs: MostTradedPairInfo[];
        }>(`${this.baseurl}/${DEX_CONTROLLER}/most-traded/pairs`, { params })
        .pipe(
          map((response) =>
            (response?.pairs ?? []).map((entry): MostTradedPairResult => {
              const pairData = entry.pair;
              const normalizeToken = (
                raw: RawMostTradedToken | undefined,
              ): MostTradedPairToken => ({
                id: raw?.id ?? raw?.address ?? '',
                symbol: raw?.symbol ?? '',
                name: raw?.name ?? '',
                decimals: raw?.decimals ?? '18',
              });
              return {
                pair: {
                  id: pairData.id ?? '',
                  token0: normalizeToken(pairData.token0),
                  token1: normalizeToken(pairData.token1),
                },
                amountKAS: entry.amountKAS ?? '',
                swapCount: entry.swapCount ?? 0,
              };
            }),
          ),
          catchError(() => of([])),
        ),
    );
  }

  /**
   * GET /explorer/lfg-tokens/search?network=...&search=...
   * Search LFG (bonding-curve) tokens by name, symbol, or address
   */
  searchLfgTokens(searchTerm: string): Promise<LfgSearchToken[]> {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return Promise.resolve([]);

    const params = this.buildHttpParamsWithNetwork({
      search: trimmedSearchTerm,
      sortBy: 'marketCapUSD',
      sortDirection: 'desc',
      volumeChangeWindow: '1d',
      page: '1',
    });

    return firstValueFrom(
      this.httpClient
        .get<{
          success: boolean;
          result: LfgSearchToken[];
        }>(`${this.baseurl}/${EXPLORER_CONTROLLER}/lfg-tokens/search`, {
          params,
        })
        .pipe(
          map((response) => (response?.success ? response.result : [])),
          catchError(() => of([])),
        ),
    );
  }

  /**
   * GET /tokens/:tokenAddress/metadata?network=...
   * Get token metadata by exact address
   */
  getTokenMetadata(
    tokenAddress: string,
  ): Promise<{ name: string; symbol: string; decimals: string } | null> {
    const params = this.buildHttpParamsWithNetwork();

    return firstValueFrom(
      this.httpClient
        .get<{
          name: string;
          symbol: string;
          decimals: string;
        }>(`${this.baseurl}/${TOKENS_CONTROLLER}/${tokenAddress}/metadata`, {
          params,
        })
        .pipe(catchError(() => of(null))),
    );
  }
}
