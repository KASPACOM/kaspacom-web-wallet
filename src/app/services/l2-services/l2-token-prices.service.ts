import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Contract, formatUnits, JsonRpcProvider } from 'ethers';
import {
  NETWORKS,
  SwapService,
  type Erc20Token,
  type KaspaComSdkPair,
  type SwapSdkNetworkConfig,
} from '@kaspacom/swap-sdk';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';
import { KaspaPriceService } from '../kaspa-price.service';
import { environment } from '../../../environments/environment';
import type {
  VerifiedTokenExternalUsdPriceInterface,
  VerifiedTokenInterface,
} from '../../../environments/environment.interface';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const LP_PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112, uint112, uint32)',
  'function totalSupply() external view returns (uint256)',
];
const ERC20_DECIMALS_ABI = ['function decimals() external view returns (uint8)'];
const KAS_AMOUNT_CACHE_TTL_MS = 3 * 60 * 1000;
const PAIRS_REFRESH_TTL_MS = 5 * 60 * 1000;
const PAIRS_REFRESH_BACKOFF_MS = 30 * 1000;
const CONCURRENT_PRICE_JOBS = 5;
const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';
const EXTERNAL_USD_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

type CoinGeckoSimplePriceResponse = Record<string, { usd?: number }>;

interface CachedKasAmount {
  kasAmount: number;
  cachedAt: number;
}

interface ExternalUsdPriceCacheEntry {
  priceUsd: number;
  lastUpdated: Date;
}

interface ChainSwapContext {
  service: SwapService;
  networkConfig: SwapSdkNetworkConfig;
  pairsRefreshedAt: number;
  provider: JsonRpcProvider;
}

@Injectable({ providedIn: 'root' })
export class L2TokenPricesService implements OnDestroy {
  private chainManager = inject(EthereumWalletChainManager);
  private kaspaPrice = inject(KaspaPriceService);
  private http = inject(HttpClient);

  // Cache stores KAS amounts (the expensive on-chain part), keyed by `chainId:address`
  private _kasAmounts = signal<Map<string, CachedKasAmount>>(new Map());
  private readonly _externalUsdPriceCache = new Map<string, ExternalUsdPriceCacheEntry>();
  private readonly _externalUsdPriceRequests = new Map<string, Promise<void>>();

  // Derives USD prices reactively — updates instantly when KAS/USD price ticks.
  // Outer key: chainId. Inner key: lowercased token address.
  public readonly pricesByChain = computed<Map<string, Map<string, number>>>(() => {
    const kasUsd = this.kaspaPrice.price();
    if (!kasUsd) return new Map();

    const now = Date.now();
    const result = new Map<string, Map<string, number>>();
    for (const [cacheKey, { kasAmount, cachedAt }] of this._kasAmounts()) {
      if (now - cachedAt >= KAS_AMOUNT_CACHE_TTL_MS) continue;
      const { chainId, address } = L2TokenPricesService.parseCacheKey(cacheKey);
      let chainMap = result.get(chainId);
      if (!chainMap) {
        chainMap = new Map<string, number>();
        result.set(chainId, chainMap);
      }
      chainMap.set(address, kasAmount * kasUsd);
    }
    return result;
  });

  private static buildCacheKey(chainId: string, address: string): string {
    return `${chainId}:${address.toLowerCase()}`;
  }

  private static parseCacheKey(key: string): { chainId: string; address: string } {
    const i = key.indexOf(':');
    return { chainId: key.slice(0, i), address: key.slice(i + 1) };
  }

  private contextByChain = new Map<string, ChainSwapContext>();
  private readonly _nonLpAddresses = new Set<string>();

  async getPriceMap(
    tokens: Erc20Token[],
    chainId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!tokens.length) return map;

    const now = Date.now();
    const kasUsd = this.kaspaPrice.price();
    if (!kasUsd) return map;

    // Pre-fetch all CoinGecko prices for this chain in one batch
    const verifiedTokens = this.getVerifiedTokens(chainId);
    if (verifiedTokens.length) {
      await this.fetchExternalUsdPricesForChain(verifiedTokens, chainId);
    }

    const cachedKasAmounts = this._kasAmounts();
    const tokensForDex: Erc20Token[] = [];

    for (const token of tokens) {
      const address = token.address.toLowerCase();
      const cacheKey = L2TokenPricesService.buildCacheKey(chainId, address);
      const cached = cachedKasAmounts.get(cacheKey);

      if (cached && now - cached.cachedAt < KAS_AMOUNT_CACHE_TTL_MS) {
        map.set(address, cached.kasAmount * kasUsd);
        continue;
      }

      // Try CoinGecko external price
      const extConfig = this.getExternalUsdPriceConfig(address, chainId);
      if (extConfig) {
        const extCacheKey = this.getExternalUsdPriceCacheKey(chainId, extConfig.coinGeckoId);
        const extCached = this._externalUsdPriceCache.get(extCacheKey);
        if (
          this.isExternalUsdPriceCacheFresh(extCached) &&
          Number.isFinite(extCached.priceUsd) &&
          extCached.priceUsd > 0
        ) {
          map.set(address, extCached.priceUsd);
          continue;
        }
      }

      tokensForDex.push(token);
    }

    if (!tokensForDex.length) return map;

    const ctx = this.getChainContext(chainId);
    if (!ctx) return map;

    const wrappedAddr = ctx.networkConfig.wrappedToken.address.toLowerCase();
    const immediateTokens = tokensForDex.filter((t) => {
      const addr = t.address.toLowerCase();
      return addr === NATIVE_TOKEN_ADDRESS || addr === wrappedAddr;
    });
    const pairDependentTokens = tokensForDex.filter((t) => {
      const addr = t.address.toLowerCase();
      return addr !== NATIVE_TOKEN_ADDRESS && addr !== wrappedAddr;
    });

    const processTokenPrices = async (tokens: Erc20Token[]) => {
      if (!tokens.length) return;

      const queue = [...tokens];
      let active = 0;

      await new Promise<void>((resolve) => {
        const tryNext = () => {
          if (!queue.length && active === 0) {
            resolve();
            return;
          }
          while (active < CONCURRENT_PRICE_JOBS && queue.length) {
            const token = queue.shift()!;
            active++;
            this.fetchKasAmountForToken(token, chainId)
              .then((kasAmount) => {
                if (kasAmount !== undefined) {
                  map.set(token.address.toLowerCase(), kasAmount * kasUsd);
                }
              })
              .catch(() => undefined)
              .finally(() => {
                active--;
                tryNext();
              });
          }
        };
        tryNext();
      });
    };

    await processTokenPrices(immediateTokens);

    if (pairDependentTokens.length) {
      await this.ensurePairsReady(chainId);
      await processTokenPrices(pairDependentTokens);
    }
    return map;
  }

  async calculateTokenPriceInUSD(
    token: Erc20Token,
    chainId: string,
  ): Promise<number | undefined> {
    const externalPrice = await this.getExternalUsdPrice(token.address, chainId);
    if (externalPrice !== null && Number.isFinite(externalPrice) && externalPrice > 0) {
      return externalPrice;
    }

    const kasUsdPrice = this.kaspaPrice.price();
    if (!kasUsdPrice) return undefined;
    const kasAmount = await this.fetchKasAmountForToken(token, chainId);
    return kasAmount !== undefined ? kasAmount * kasUsdPrice : undefined;
  }

  private cacheKasAmount(cacheKey: string, kasAmount: number): void {
    this._kasAmounts.update((current) => {
      const now = Date.now();
      const next = new Map(current);
      for (const [key, entry] of next) {
        if (now - entry.cachedAt >= KAS_AMOUNT_CACHE_TTL_MS) next.delete(key);
      }
      next.set(cacheKey, { kasAmount, cachedAt: now });
      return next;
    });
  }

  private async fetchLpTokenKasAmount(
    token: Erc20Token,
    chainId: string,
    ctx: ChainSwapContext,
  ): Promise<number | undefined> {
    const addr = token.address.toLowerCase();
    const nonLpKey = `${chainId}:${addr}`;
    if (this._nonLpAddresses.has(nonLpKey)) return undefined;

    try {
      const pair = new Contract(token.address, LP_PAIR_ABI, ctx.provider);
      const [token0Addr, token1Addr, reserves, totalSupplyRaw] = await Promise.all([
        pair['token0']() as Promise<string>,
        pair['token1']() as Promise<string>,
        pair['getReserves']() as Promise<[bigint, bigint, number]>,
        pair['totalSupply']() as Promise<bigint>,
      ]);

      const makeErc20 = (a: string) => new Contract(a, ERC20_DECIMALS_ABI, ctx.provider);
      const [t0Dec, t1Dec]: number[] = await Promise.all([
        (makeErc20(token0Addr)['decimals']() as Promise<number>).catch(() => 18),
        (makeErc20(token1Addr)['decimals']() as Promise<number>).catch(() => 18),
      ]);

      const reserve0 = parseFloat(formatUnits(reserves[0], t0Dec));
      const reserve1 = parseFloat(formatUnits(reserves[1], t1Dec));
      const totalSupply = parseFloat(formatUnits(totalSupplyRaw, 18));
      if (totalSupply <= 0) {
        this._nonLpAddresses.add(nonLpKey);
        return undefined;
      }

      const wrappedAddr = ctx.networkConfig.wrappedToken.address.toLowerCase();
      const norm0 = token0Addr.toLowerCase();
      const norm1 = token1Addr.toLowerCase();
      const isAnchor0 = norm0 === NATIVE_TOKEN_ADDRESS || norm0 === wrappedAddr;
      const isAnchor1 = norm1 === NATIVE_TOKEN_ADDRESS || norm1 === wrappedAddr;

      // When one side is the native/wrapped KAS anchor, price the LP using only
      // the anchor's reserve. The other side's price is implied by the pool ratio,
      // matching how the defi app prices via router.getAmountsOut (pool-internal price).
      // Formula: 2 × reserve_anchor / totalSupply (each side equal value at pool prices).
      if (isAnchor0 && reserve0 > 0) return (2 * reserve0) / totalSupply;
      if (isAnchor1 && reserve1 > 0) return (2 * reserve1) / totalSupply;

      // Neither side is WKAS/native — fall back to external prices.
      const kasUsd = this.kaspaPrice.price();

      const getUnderlyingKasAmount = async (
        underlyingAddr: string,
        decimals: number,
      ): Promise<number | undefined> => {
        const norm = underlyingAddr.toLowerCase();

        // Use warmed CoinGecko cache if available
        const extConfig = this.getExternalUsdPriceConfig(norm, chainId);
        if (extConfig && kasUsd) {
          const extKey = this.getExternalUsdPriceCacheKey(chainId, extConfig.coinGeckoId);
          const cached = this._externalUsdPriceCache.get(extKey);
          if (this.isExternalUsdPriceCacheFresh(cached) && cached.priceUsd > 0) {
            return cached.priceUsd / kasUsd;
          }
        }

        // Use DEX cache
        const dexKey = L2TokenPricesService.buildCacheKey(chainId, norm);
        const dexCached = this._kasAmounts().get(dexKey);
        if (dexCached && Date.now() - dexCached.cachedAt < KAS_AMOUNT_CACHE_TTL_MS) {
          return dexCached.kasAmount;
        }

        // depth=1 prevents LP→LP recursion
        return this.fetchKasAmountForToken(
          { address: underlyingAddr, decimals, symbol: '', name: '' },
          chainId,
          1,
        );
      };

      const [kas0, kas1] = await Promise.all([
        getUnderlyingKasAmount(token0Addr, t0Dec),
        getUnderlyingKasAmount(token1Addr, t1Dec),
      ]);

      if (kas0 === undefined && kas1 === undefined) return undefined;

      // If only one side is priceable, derive the other from the pool ratio.
      let effective0 = kas0;
      let effective1 = kas1;
      if (kas0 === undefined && kas1 !== undefined && reserve0 > 0) {
        effective0 = (kas1 * reserve1) / reserve0;
      } else if (kas1 === undefined && kas0 !== undefined && reserve1 > 0) {
        effective1 = (kas0 * reserve0) / reserve1;
      }

      const totalKas = reserve0 * (effective0 ?? 0) + reserve1 * (effective1 ?? 0);
      if (totalKas <= 0) return undefined;

      return totalKas / totalSupply;
    } catch {
      this._nonLpAddresses.add(nonLpKey);
      return undefined;
    }
  }

  private async fetchKasAmountForToken(
    token: Erc20Token,
    chainId: string,
    depth = 0,
  ): Promise<number | undefined> {
    const addr = token.address.toLowerCase();

    if (addr === NATIVE_TOKEN_ADDRESS) return 1;

    const ctx = this.getChainContext(chainId);
    if (!ctx) return undefined;

    const wrappedAddr = ctx.networkConfig.wrappedToken.address.toLowerCase();
    if (addr === wrappedAddr) return 1;

    const cacheKey = L2TokenPricesService.buildCacheKey(chainId, addr);
    const cached = this._kasAmounts().get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < KAS_AMOUNT_CACHE_TTL_MS) {
      return cached.kasAmount;
    }

    // Try LP token pricing before DEX swap routing.
    // depth guard prevents LP→LP infinite recursion.
    if (depth === 0) {
      const lpKasAmount = await this.fetchLpTokenKasAmount(token, chainId, ctx);
      if (lpKasAmount !== undefined) {
        this.cacheKasAmount(cacheKey, lpKasAmount);
        return lpKasAmount;
      }
    }

    await this.ensurePairsReady(chainId);

    try {
      const { computed: tradeComputed } = await ctx.service.calculateTrade(
        token,
        ctx.networkConfig.wrappedToken,
        '1',
        false,
        '0.5',
      );

      const kasAmount = parseFloat(tradeComputed.amountOut);
      if (!isFinite(kasAmount) || kasAmount <= 0) return undefined;

      this.cacheKasAmount(cacheKey, kasAmount);
      return kasAmount;
    } catch {
      return undefined;
    }
  }

  private async ensurePairsReady(chainId: string): Promise<void> {
    const ctx = this.getChainContext(chainId);
    if (!ctx) return;

    if (Date.now() - ctx.pairsRefreshedAt > PAIRS_REFRESH_TTL_MS) {
      try {
        await ctx.service.refreshPairs();
        ctx.pairsRefreshedAt = Date.now();
      } catch {
        ctx.pairsRefreshedAt = Date.now() - PAIRS_REFRESH_TTL_MS + PAIRS_REFRESH_BACKOFF_MS;
        return;
      }
    } else {
      await ctx.service.waitForPairsLoaded().catch(() => undefined);
    }
  }

  private getChainContext(chainId: string): ChainSwapContext | null {
    if (this.contextByChain.has(chainId)) {
      return this.contextByChain.get(chainId)!;
    }

    const envConfig = this.chainManager.getChainEnvConfig(chainId);
    if (!envConfig) return null;

    const cc = envConfig.customChainConfig;
    let networkConfig: SwapSdkNetworkConfig;

    const baseNetwork = NETWORKS[envConfig.sdkName];
    if (baseNetwork) {
      const customWrappedAddr = cc.wrappedTokenAddress;
      networkConfig = {
        ...baseNetwork,
        rpcUrl: cc.rpcUrl,
        ...(customWrappedAddr && {
          wrappedToken: { ...baseNetwork.wrappedToken, address: customWrappedAddr },
        }),
      };
    } else {
      // SDK doesn't know this network — build the config from the environment.
      if (!cc.swapContracts || !cc.wrappedTokenAddress) return null;

      networkConfig = {
        name: cc.name,
        chainId: cc.chainId,
        rpcUrl: cc.rpcUrl,
        routerAddress: cc.swapContracts.routerAddress,
        factoryAddress: cc.swapContracts.factoryAddress,
        proxyAddress: cc.swapContracts.proxyAddress,
        badckendApiUrl: environment.kaspaComDefiApiBaseurl,
        blockExplorerUrl: cc.blockExplorerUrl,
        defiApiNetworkName: cc.defiApiNetworkName ?? '',
        nativeToken: {
          address: cc.nativeToken.address,
          decimals: cc.nativeToken.decimals,
          name: cc.nativeToken.name,
          symbol: cc.nativeToken.symbol,
        },
        wrappedToken: {
          address: cc.wrappedTokenAddress,
          decimals: 18,
          name: `Wrapped ${cc.nativeToken.symbol}`,
          symbol: `W${cc.nativeToken.symbol}`,
        },
      };
    }

    const provider = new JsonRpcProvider(cc.rpcUrl);
    const service = new SwapService(provider, networkConfig, {
      networkConfig,
      maxHops: 3,
      getPairsData: () => this.fetchPairsGracefully(networkConfig),
    });

    const ctx: ChainSwapContext = { service, networkConfig, pairsRefreshedAt: Date.now(), provider };
    this.contextByChain.set(chainId, ctx);
    return ctx;
  }

  private async fetchPairsGracefully(networkConfig: SwapSdkNetworkConfig): Promise<KaspaComSdkPair[]> {
    try {
      const response = await fetch(
        `${networkConfig.badckendApiUrl}/dex/graph-pairs?network=${networkConfig.defiApiNetworkName}`,
      );
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // --- CoinGecko external USD price methods ---

  private getVerifiedTokens(chainId: string): VerifiedTokenInterface[] {
    return this.chainManager.getChainEnvConfig(chainId)?.verifiedTokens ?? [];
  }

  private getExternalUsdPriceConfig(
    tokenAddress: string,
    chainId: string,
  ): VerifiedTokenExternalUsdPriceInterface | undefined {
    return this.getVerifiedTokens(chainId).find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase(),
    )?.externalUsdPrice;
  }

  private getExternalUsdPriceCacheKey(chainId: string, coinGeckoId: string): string {
    return `${chainId}:${coinGeckoId.trim().toLowerCase()}`;
  }

  private isExternalUsdPriceCacheFresh(
    entry: ExternalUsdPriceCacheEntry | undefined,
  ): entry is ExternalUsdPriceCacheEntry {
    return !!entry && entry.lastUpdated.getTime() > Date.now() - EXTERNAL_USD_PRICE_CACHE_TTL_MS;
  }

  private async fetchAndCacheCoinGeckoUsdPrices(
    chainId: string,
    coinGeckoIds: string[],
  ): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<CoinGeckoSimplePriceResponse>(COINGECKO_SIMPLE_PRICE_URL, {
          params: new HttpParams()
            .set('ids', coinGeckoIds.join(','))
            .set('vs_currencies', 'usd'),
        }),
      );

      const now = new Date();
      for (const coinGeckoId of coinGeckoIds) {
        const usdPrice = response[coinGeckoId]?.usd;
        const valid =
          typeof usdPrice === 'number' && Number.isFinite(usdPrice) && usdPrice > 0;
        this._externalUsdPriceCache.set(
          this.getExternalUsdPriceCacheKey(chainId, coinGeckoId),
          { priceUsd: valid ? usdPrice! : Number.NaN, lastUpdated: now },
        );
      }
    } catch {
      const now = new Date();
      for (const id of coinGeckoIds) {
        this._externalUsdPriceCache.set(
          this.getExternalUsdPriceCacheKey(chainId, id),
          { priceUsd: Number.NaN, lastUpdated: now },
        );
      }
    }
  }

  private async fetchExternalUsdPricesForChain(
    verifiedTokens: VerifiedTokenInterface[],
    chainId: string,
    forceRefresh = false,
  ): Promise<void> {
    const coinGeckoIds = Array.from(
      new Set(
        verifiedTokens
          .map((t) => t.externalUsdPrice)
          .filter(
            (c): c is VerifiedTokenExternalUsdPriceInterface => c?.provider === 'coingecko',
          )
          .map((c) => c.coinGeckoId.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (!coinGeckoIds.length) return;

    const staleIds = forceRefresh
      ? coinGeckoIds
      : coinGeckoIds.filter(
          (id) =>
            !this.isExternalUsdPriceCacheFresh(
              this._externalUsdPriceCache.get(this.getExternalUsdPriceCacheKey(chainId, id)),
            ),
        );

    if (!staleIds.length) return;

    const requestKey = `${chainId}:${[...staleIds].sort().join(',')}`;
    const pending = this._externalUsdPriceRequests.get(requestKey);
    if (pending) {
      await pending;
      return;
    }

    const promise = this.fetchAndCacheCoinGeckoUsdPrices(chainId, staleIds);
    this._externalUsdPriceRequests.set(requestKey, promise);
    try {
      await promise;
    } finally {
      this._externalUsdPriceRequests.delete(requestKey);
    }
  }

  private async getExternalUsdPrice(
    tokenAddress: string,
    chainId: string,
    forceRefresh = false,
  ): Promise<number | null> {
    const config = this.getExternalUsdPriceConfig(tokenAddress, chainId);
    if (!config) return null;

    const cacheKey = this.getExternalUsdPriceCacheKey(chainId, config.coinGeckoId);
    if (!forceRefresh) {
      const cached = this._externalUsdPriceCache.get(cacheKey);
      if (this.isExternalUsdPriceCacheFresh(cached)) {
        return Number.isFinite(cached.priceUsd) ? cached.priceUsd : null;
      }
    }

    const verifiedTokens = this.getVerifiedTokens(chainId);
    await this.fetchExternalUsdPricesForChain(verifiedTokens, chainId, forceRefresh);

    const finalCached = this._externalUsdPriceCache.get(cacheKey);
    return finalCached && Number.isFinite(finalCached.priceUsd) ? finalCached.priceUsd : null;
  }

  ngOnDestroy(): void {
    this.contextByChain.clear();
    this._nonLpAddresses.clear();
  }
}
