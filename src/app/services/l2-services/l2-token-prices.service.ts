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

  // Derives USD prices reactively — updates instantly when KAS/USD price ticks
  public readonly tokenPrices = computed<Map<string, number>>(() => {
    const kasUsd = this.kaspaPrice.price();
    const map = new Map<string, number>();
    for (const [key, { kasAmount }] of this._kasAmounts()) {
      map.set(key, kasAmount * kasUsd);
    }
    return map;
  });

  private contextByChain = new Map<string, ChainSwapContext>();

  async getPriceMap(
    tokens: Erc20Token[],
    chainId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!tokens.length) return map;

    const now = Date.now();
    const kasUsd = this.kaspaPrice.price();
    const cachedKasAmounts = this._kasAmounts();
    const tokensToRefresh: Erc20Token[] = [];

    for (const token of tokens) {
      const address = token.address.toLowerCase();
      const cacheKey = `${chainId}:${address}`;
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

    await this.ensurePairsReady(chainId);

    const queue = [...tokensToRefresh];
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
          this.calculateTokenPriceInUSD(token, chainId)
            .then((price) => {
              if (price !== undefined) {
                map.set(token.address.toLowerCase(), price);
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

    return map;
  }

  async calculateTokenPriceInUSD(
    token: Erc20Token,
    chainId: string,
  ): Promise<number | undefined> {
    const kasUsdPrice = this.kaspaPrice.price();
    if (!kasUsdPrice) return undefined;

    const addr = token.address.toLowerCase();

    if (addr === NATIVE_TOKEN_ADDRESS) {
      return kasUsdPrice;
    }

    const ctx = this.getChainContext(chainId);
    if (!ctx) return undefined;

    const wrappedAddr = ctx.networkConfig.wrappedToken.address.toLowerCase();
    if (addr === wrappedAddr) {
      return kasUsdPrice;
    }

    const cacheKey = `${chainId}:${addr}`;
    const cached = this._kasAmounts().get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < KAS_AMOUNT_CACHE_TTL_MS) {
      return cached.kasAmount * kasUsdPrice;
    }

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
        const next = new Map(current);
        next.set(cacheKey, { kasAmount, cachedAt: Date.now() });
        return next;
      });

      return kasAmount * kasUsdPrice;
    } catch {
      return undefined;
    }
  }

  private async ensurePairsReady(chainId: string): Promise<void> {
    const ctx = this.getChainContext(chainId);
    if (!ctx) return;

    if (Date.now() - ctx.pairsRefreshedAt > PAIRS_REFRESH_TTL_MS) {
      await ctx.service.refreshPairs().catch(() => undefined);
      ctx.pairsRefreshedAt = Date.now();
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

    const ctx: ChainSwapContext = { service, networkConfig, pairsRefreshedAt: Date.now() };
    this.contextByChain.set(chainId, ctx);
    return ctx;
  }

  ngOnDestroy(): void {
    this.contextByChain.clear();
  }
}
