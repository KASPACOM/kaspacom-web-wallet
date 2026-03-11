import { inject, Injectable } from '@angular/core';
import {
  BaseAssetsStoreService,
  BaseAssetStoreData,
} from './base-assets-store.service';
import { Erc20Token } from '@kaspacom/swap-sdk';
import _ from 'lodash';
import { EthereumWalletChainManager } from '../../etherium-services/etherium-wallet-chain.manager';
import { L2WalletState } from '../../../classes/AppWallet';
import { ERC20Contract } from '../../etherium-services/smart-contracts/contracts/erc20-contract';
import { ethers, formatUnits } from 'ethers';
import { L2LocalERC20Tokens } from '../../l2-services/l2-local-erc20-tokens';
import { UtilsHelper } from '../../utils.service';
import { KaspaComDefiApiService } from '../../kaspacom-api/kaspacom-defi-api.service';

export const L2_ASSET_KEYS = {
  l2State: 'l2State',
  erc20: 'erc20',
  // erc721: 'erc721',
  // ens: 'ens',
};

export interface L2AssetStoreData extends BaseAssetStoreData {
  [L2_ASSET_KEYS.erc20]: Erc20Token;
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

  protected override getLoadFunctionAssetsNames(): {
    [K in keyof L2AssetStoreData]: string;
  } {
    return {
      l2State: 'refreshL2WalletState',
      erc20: 'getErc20Tokens',
    };
  }

  /**
   * Reload KRC20 tokens with pagination
   */
  protected async getErc20Tokens(walletAddress: string): Promise<Erc20Token[]> {
    const [erc20TokensFromContracts, erc20TokensFromGraph] = await Promise.all([
      this.getErc20TokensFromSavedTokens(walletAddress),
      this.getErc20TokensFromGraph(walletAddress).catch(() => []),
    ]);

    const tokensById = _.keyBy(erc20TokensFromGraph, 'address');

    for (const token of erc20TokensFromContracts) {
      tokensById[token.address] = token;
    }

    return Object.values(tokensById);
  }

  protected async getErc20TokensFromGraph(
    walletAddress: string,
  ): Promise<Erc20Token[]> {
    if (!this.ethereumWalletChainManager.getCurrentChainSignal()()) return [];

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
  ): Promise<Erc20Token[]> {
    const tokens = await this.l2LocalERC20Tokens.getAllTokensByChain(
      this.ethereumWalletChainManager.getCurrentChainSignal()()!,
    );

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
      this.updateOrAddAsset(L2_ASSET_KEYS.erc20, token, 'address', true);
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

  protected async addTokenToLocalStore(token: Erc20Token) {
    const chain = this.ethereumWalletChainManager.getCurrentChainSignal()();

    if (!chain) {
      throw new Error('Chain not found');
    }

    await this.l2LocalERC20Tokens.addToken(token, chain);
    await this.reloadAsset(L2_ASSET_KEYS.erc20);
  }

  protected async removeTokenFromLocalStore(token: Erc20Token) {
    const chain = this.ethereumWalletChainManager.getCurrentChainSignal()();

    if (!chain) {
      throw new Error('Chain not found');
    }

    await this.l2LocalERC20Tokens.removeToken(token, chain);
    await this.reloadAsset(L2_ASSET_KEYS.erc20);
  }

  protected isErc20TokenSavedOnLocalStorage(tokenAddress: string): boolean {
    return !!this.l2LocalERC20Tokens.getToken(
      tokenAddress,
      this.ethereumWalletChainManager.getCurrentChainSignal()()!,
    );
  }
}
