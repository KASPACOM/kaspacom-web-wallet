import { inject, Injectable } from "@angular/core";
import { BaseAssetsStoreService, BaseAssetStoreData } from "./base-assets-store.service";
import { GetTokenListDto } from "../../kasplex-api/dtos/token-list-info.dto";
import { Erc20Token } from "@kaspacom/swap-sdk";
import _ from "lodash";
import { Erc20GraphService } from "../../erc20-graph.service";
import { EthereumWalletChainManager } from "../../etherium-services/etherium-wallet-chain.manager";
import { L2WalletState } from "../../../classes/AppWallet";
import { ERC20Contract } from "../../etherium-services/smart-contracts/contracts/erc20-contract";
import { WalletActionService } from "../../wallet-action.service";
import { formatUnits } from "ethers";

export const L2_ASSET_KEYS = {
    l2State: 'l2State',
    erc20: 'erc20',
    // erc721: 'erc721',
    // ens: 'ens',
}

export interface L2AssetStoreData extends BaseAssetStoreData {
    [L2_ASSET_KEYS.erc20]: Erc20Token;
    [L2_ASSET_KEYS.l2State]: L2WalletState;
}

@Injectable({
    providedIn: 'root',
})
export class L2AssetsStoreService extends BaseAssetsStoreService<L2AssetStoreData> {
    protected erc20GraphService = inject(Erc20GraphService);
    protected ethereumWalletChainManager = inject(EthereumWalletChainManager);
    protected walletActionsService = inject(WalletActionService);

    protected override getLoadFunctionAssetsNames(): { [K in keyof L2AssetStoreData]: string } {
        return {
            l2State: 'refreshL2WalletState',
            erc20: 'getErc20Tokens',
        }
    }

    /**
     * Reload KRC20 tokens with pagination
     */
    protected async getErc20Tokens(walletAddress: string): Promise<Erc20Token[]> {
        const [erc20TokensFromContracts, erc20TokensFromGraph] = await Promise.all([
            this.getErc20TokensFromContracts(walletAddress),
            this.getErc20TokensFromGraph(walletAddress).catch(() => []),
        ]);

        const tokensById = _.keyBy(erc20TokensFromGraph, 'address');

        for (const token of erc20TokensFromContracts) {
            tokensById[token.address] = token;
        }

        return Object.values(tokensById);
    }


    protected async getErc20TokensFromGraph(walletAddress: string): Promise<Erc20Token[]> {
        if (!this.ethereumWalletChainManager.getCurrentChainSignal()()) return [];
        return await this.erc20GraphService.getBalances(walletAddress, this.ethereumWalletChainManager.getCurrentChainSignal()()!);
    }

    protected async getErc20TokensFromContracts(walletAddress: string): Promise<Erc20Token[]> {
        return [];
    }

    protected async refreshL2WalletState(walletAddress: string): Promise<L2WalletState[]> {
        // This is only for refreshing the L2 wallet state
        await this.walletService.getCurrentWallet()!.refreshL2Balance();
        return [];
    }

    public async getErc20InfoFromBlockchain(tokenAddress: string, skipUpdate?: boolean): Promise<Erc20Token> {
        const contract = ERC20Contract.getContract(this.walletService, this.walletActionsService, tokenAddress);


        const [balance, decimals, name, symbol] = await Promise.all([
            contract.balanceOf((await this.walletService.getCurrentWallet()?.getL2WalletAddress())!),
            contract.decimals(),
            contract.name(),
            contract.symbol(),
        ])

        const token: Erc20Token = {
            address: tokenAddress,
            balance: parseFloat(formatUnits(balance.toString(), decimals)),
            decimals: Number(decimals),
            name: name,
            symbol: symbol,
        };

        if (!skipUpdate) {
            this.updateOrAddAsset(L2_ASSET_KEYS.erc20, token, 'address', true);
        }

        return token;
    }


}