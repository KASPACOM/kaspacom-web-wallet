import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { JsonRpcProvider } from 'ethers';
import {
  NETWORKS,
  SwapService,
  type Erc20Token,
  type SwapSdkNetworkConfig,
} from '@kaspacom/swap-sdk';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';
import { KaspaPriceService } from '../kaspa-price.service';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const KAS_AMOUNT_CACHE_TTL_MS = 3 * 60 * 1000;
const PAIRS_REFRESH_TTL_MS = 5 * 60 * 1000;
const PAIRS_REFRESH_BACKOFF_MS = 30 * 1000;
const CONCURRENT_PRICE_JOBS = 5;

interface CachedKasAmount {
  kasAmount: number;
  cachedAt: number;
}

interface ChainSwapContext {
  service: SwapService;
  networkConfig: SwapSdkNetworkConfig;
  pairsRefreshedAt: number;
}

@Injectable({ providedIn: 'root' })
export class L2TokenPricesService implements OnDestroy {
  private chainManager = inject(EthereumWalletChainManager);
  private kaspaPrice = inject(KaspaPriceService);

  // Cache stores KAS amounts (the expensive on-chain part), keyed by `chainId:address`
  private _kasAmounts = signal<Map<string, CachedKasAmount>>(new Map());

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

  async getPriceMap(
    tokens: Erc20Token[],
    chainId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!tokens.length) return map;

    const now = Date.now();
    const kasUsd = this.kaspaPrice.price();
    if (!kasUsd) return map;

    const cachedKasAmounts = this._kasAmounts();
    const tokensToRefresh: Erc20Token[] = [];

    for (const token of tokens) {
      const address = token.address.toLowerCase();
      const cacheKey = L2TokenPricesService.buildCacheKey(chainId, address);
      const cached = cachedKasAmounts.get(cacheKey);

      if (cached && now - cached.cachedAt < KAS_AMOUNT_CACHE_TTL_MS) {
        map.set(address, cached.kasAmount * kasUsd);
      } else {
        tokensToRefresh.push(token);
      }
    }

    if (!tokensToRefresh.length) {
      return map;
    }

    const ctx = this.getChainContext(chainId);
    if (!ctx) return map;

    const wrappedAddr = ctx.networkConfig.wrappedToken.address.toLowerCase();
    const immediateTokens = tokensToRefresh.filter((t) => {
      const addr = t.address.toLowerCase();
      return addr === NATIVE_TOKEN_ADDRESS || addr === wrappedAddr;
    });
    const pairDependentTokens = tokensToRefresh.filter((t) => {
      const addr = t.address.toLowerCase();
      return addr !== NATIVE_TOKEN_ADDRESS && addr !== wrappedAddr;
    });

    const processTokenPrices = async (tokens: Erc20Token[]) => {
      if (!tokens.length) {
        return;
      }

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
    const kasUsdPrice = this.kaspaPrice.price();
    if (!kasUsdPrice) return undefined;
    const kasAmount = await this.fetchKasAmountForToken(token, chainId);
    return kasAmount !== undefined ? kasAmount * kasUsdPrice : undefined;
  }

  private async fetchKasAmountForToken(
    token: Erc20Token,
    chainId: string,
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

      this._kasAmounts.update((current) => {
        const now = Date.now();
        const next = new Map(current);
        for (const [key, entry] of next) {
          if (now - entry.cachedAt >= KAS_AMOUNT_CACHE_TTL_MS) next.delete(key);
        }
        next.set(cacheKey, { kasAmount, cachedAt: now });
        return next;
      });

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

    const baseNetwork = NETWORKS[envConfig.sdkName];
    if (!baseNetwork) return null;

    const customWrappedAddr = envConfig.customChainConfig.wrappedTokenAddress;
    const networkConfig: SwapSdkNetworkConfig = {
      ...baseNetwork,
      rpcUrl: envConfig.customChainConfig.rpcUrl,
      ...(customWrappedAddr && {
        wrappedToken: { ...baseNetwork.wrappedToken, address: customWrappedAddr },
      }),
    };

    const provider = new JsonRpcProvider(envConfig.customChainConfig.rpcUrl);
    const service = new SwapService(provider, networkConfig, {
      networkConfig,
      maxHops: 3,
    });

    const ctx: ChainSwapContext = { service, networkConfig, pairsRefreshedAt: 0 };
    this.contextByChain.set(chainId, ctx);
    return ctx;
  }

  ngOnDestroy(): void {
    this.contextByChain.clear();
  }
}
