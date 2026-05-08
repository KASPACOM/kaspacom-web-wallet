import { inject, Injectable } from '@angular/core';
import {
  BaseAssetsStoreService,
  BaseAssetStoreData,
} from './base-assets-store.service';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { EthereumWalletChainManager } from '../../etherium-services/etherium-wallet-chain.manager';
import { L2WalletState } from '../../../classes/AppWallet';
import { ERC20Contract } from '../../etherium-services/smart-contracts/contracts/erc20-contract';
import { ethers, formatUnits } from 'ethers';
import { L2LocalERC20Tokens } from '../../l2-services/l2-local-erc20-tokens';
import { UtilsHelper } from '../../utils.service';
import { KaspaComDefiApiService } from '../../kaspacom-api/kaspacom-defi-api.service';
import { L2TokenPricesService } from '../../l2-services/l2-token-prices.service';

export const L2_ASSET_KEYS = {
  l2State: 'l2State',
  erc20: 'erc20',
  // erc721: 'erc721',
  // ens: 'ens',
};

export type Erc20TokenWithPrice = Erc20Token & { tokenPriceUSD?: number };

export interface L2AssetStoreData extends BaseAssetStoreData {
  [L2_ASSET_KEYS.erc20]: Erc20TokenWithPrice;
  [L2_ASSET_KEYS.l2State]: L2WalletState;
}

const CONCURRENT_JOBS_NUMBER = 5;

@Injectable({
  providedIn: 'root',
})
export class L2AssetsStoreService extends BaseAssetsStoreService<L2AssetStoreData> {
  protected ethereumWalletChainManager = inject(EthereumWalletChainManager);
  protected l2LocalERC20Tokens = inject(L2LocalERC20Tokens);
  protected utilsHelper = inject(UtilsHelper);
  protected kaspacomDefiApi = inject(KaspaComDefiApiService);
  protected l2TokenPrices = inject(L2TokenPricesService);

  protected override getLoadFunctionAssetsNames(): {
    [K in keyof L2AssetStoreData]: string;
  } {
    return {
      l2State: 'refreshL2WalletState',
      erc20: 'getErc20Tokens',
    };
  }

  /**
   * Merge graph/API tokens with locally saved imports. Must key by case-normalized
   * address — API often returns lowercase `id` while local DB stores checksummed
   * addresses; otherwise the same contract appears twice in the list.
   */
  private mergeErc20TokenSources(
    graphTokens: Erc20Token[],
    localTokens: Erc20Token[],
  ): Erc20Token[] {
    const byNormAddress = new Map<string, Erc20Token>();

    const put = (token: Erc20Token) => {
      let address = token.address;
      try {
        address = ethers.getAddress(token.address);
      } catch {
        // keep as-is if the id is not a valid EVM address
      }
      const key = address.toLowerCase();
      byNormAddress.set(key, { ...token, address });
    };

    for (const t of graphTokens) {
      put(t);
    }
    for (const t of localTokens) {
      put(t);
    }

    return Array.from(byNormAddress.values());
  }

  protected async getErc20Tokens(
    walletAddress: string,
  ): Promise<Erc20TokenWithPrice[]> {
    const chainId = this.ethereumWalletChainManager.getCurrentChainSignal()();

    const [erc20TokensFromContracts, erc20TokensFromGraph] = await Promise.all([
      this.getErc20TokensFromSavedTokens(walletAddress, chainId),
      this.getErc20TokensFromGraph(walletAddress, chainId).catch(() => []),
    ]);

    if (this.ethereumWalletChainManager.getCurrentChainSignal()() !== chainId) {
      return [];
    }

    const merged = this.mergeErc20TokenSources(
      erc20TokensFromGraph,
      erc20TokensFromContracts,
    );

    const priceable = merged.filter((t) => ethers.isAddress(t.address));
    const priceByAddress = chainId
      ? await this.l2TokenPrices
          .getPriceMap(priceable, chainId)
          .catch(() => new Map<string, number>())
      : new Map<string, number>();

    if (this.ethereumWalletChainManager.getCurrentChainSignal()() !== chainId) {
      return [];
    }

    return merged.map((token) => ({
      ...token,
      tokenPriceUSD: priceByAddress.get(token.address.toLowerCase()),
    }));
  }

  protected async getErc20TokensFromGraph(
    walletAddress: string,
    chainId?: string | null,
  ): Promise<Erc20Token[]> {
    if (!(chainId ?? this.ethereumWalletChainManager.getCurrentChainSignal()())) return [];

    const tokens =
      await this.kaspacomDefiApi.getWalletTokensBalances(walletAddress);

    return tokens.map((token) => ({
      address: token.id,
      decimals: Number(token.decimals),
      name: token.name,
      symbol: token.symbol,
      balance: Number(ethers.formatUnits(token.value, token.decimals)),
    }));
  }

  protected async getErc20TokensFromSavedTokens(
    walletAddress: string,
    chainId?: string | null,
  ): Promise<Erc20Token[]> {
    const chain = chainId ?? this.ethereumWalletChainManager.getCurrentChainSignal()();
    if (!chain) return [];
    const tokens = await this.l2LocalERC20Tokens.getAllTokensByChain(chain);

    if (tokens.length == 0) {
      return [];
    }

    const results = await this.utilsHelper.runJobsConcurrently<number>(
      tokens.map(
        (token) => () =>
          this.getErc20BalanceFromBlockchain(
            token.address,
            token.decimals,
            walletAddress,
          ),
      ),
      CONCURRENT_JOBS_NUMBER,
    );

    // Combine token info + fetched data
    const combinedTokens = tokens.map((token, i) => ({
      ...token,
      balance: results[i].result || 0,
    }));

    return combinedTokens;
  }

  protected async refreshL2WalletState(
    walletAddress: string,
  ): Promise<L2WalletState[]> {
    // This is only for refreshing the L2 wallet state
    await this.walletService.getCurrentWallet()!.refreshL2Balance();
    return [];
  }

  public async getErc20InfoFromBlockchain(
    tokenAddress: string,
    updateCurrentState?: boolean,
  ): Promise<Erc20Token> {
    const contract = ERC20Contract.getContract(
      tokenAddress,
      this.walletService,
    );

    const [balance, decimals, name, symbol] = await Promise.all([
      contract.balanceOf(
        this.walletService.getCurrentWallet()?.getL2WalletAddress()!,
      ),
      contract.decimals(),
      contract.name(),
      contract.symbol(),
    ]);

    const token: Erc20Token = {
      address: tokenAddress,
      balance: parseFloat(formatUnits(balance.toString(), decimals)),
      decimals: Number(decimals),
      name: name,
      symbol: symbol,
    };

    if (updateCurrentState) {
      const existing = (this.data[L2_ASSET_KEYS.erc20]?.() ?? []).find(
        (t) => t.address?.toLowerCase() === tokenAddress.toLowerCase(),
      ) as Erc20TokenWithPrice | undefined;

      const tokenWithPrice: Erc20TokenWithPrice = {
        ...token,
        tokenPriceUSD: existing?.tokenPriceUSD,
      };
      this.updateOrAddAsset(L2_ASSET_KEYS.erc20, tokenWithPrice, 'address', true);
    }

    return token;
  }

  protected async getErc20BalanceFromBlockchain(
    tokenAddress: string,
    tokenDecimals: number,
    walletAddress: string,
  ): Promise<number> {
    const balance = await ERC20Contract.getContract(
      tokenAddress,
      this.walletService,
    ).balanceOf(walletAddress);

    return parseFloat(formatUnits(balance.toString(), tokenDecimals));
  }

  public async addTokenToLocalStore(token: Erc20Token) {
    const chain = this.ethereumWalletChainManager.getCurrentChainSignal()();

    if (!chain) {
      throw new Error('Chain not found');
    }

    await this.l2LocalERC20Tokens.addToken(
      {
        ...token,
        address: ethers.getAddress(token.address),
      },
      chain,
    );
    await this.reloadAsset(L2_ASSET_KEYS.erc20);
  }

  public async removeTokenFromLocalStore(token: Erc20Token) {
    const chain = this.ethereumWalletChainManager.getCurrentChainSignal()();

    if (!chain) {
      throw new Error('Chain not found');
    }

    await this.l2LocalERC20Tokens.removeToken(
      {
        ...token,
        address: ethers.getAddress(token.address),
      },
      chain,
    );
    await this.reloadAsset(L2_ASSET_KEYS.erc20);
  }

  public async getSavedErc20TokenLocally(tokenAddress: string): Promise<Erc20Token | null> {
    const chain = this.ethereumWalletChainManager.getCurrentChainSignal()();

    if (!chain) {
      throw new Error('Chain not found');
    }

    const normalizedAddress = ethers.getAddress(tokenAddress);
    return (await this.l2LocalERC20Tokens.getToken(normalizedAddress, chain)) ?? null;
  }

  public async isErc20TokenSavedLocally(tokenAddress: string): Promise<boolean> {
    const token = await this.getSavedErc20TokenLocally(tokenAddress);
    return !!token;
  }
}
