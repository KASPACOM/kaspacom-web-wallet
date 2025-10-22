import { inject, Injectable } from "@angular/core";
import { BaseAssetsStoreService, BaseAssetStoreData } from "./base-assets-store.service";
import { GetTokenListDto } from "../../kasplex-api/dtos/token-list-info.dto";
import { KasplexKrc20Service } from "../../kasplex-api/kasplex-api.service";
import { Krc721ApiService } from "../../krc721-api/krc721-api.service";
import { KnsApiService } from "../../kns-api/kns-api.service";
import { Erc20Token } from "@kaspacom/swap-sdk";
import _ from "lodash";
import { firstValueFrom } from "rxjs";
import { Erc20GraphService } from "../../erc20-graph.service";
import { EthereumWalletChainManager } from "../../etherium-services/etherium-wallet-chain.manager";
import { L2WalletState } from "../../../classes/AppWallet";

export const L2_ASSET_KEYS = {
    l2State: 'l2State',
    erc20: 'erc20',
    // erc721: 'erc721',
    // ens: 'ens',
}

export interface L2AssetStoreData extends BaseAssetStoreData {
    [L2_ASSET_KEYS.erc20]: GetTokenListDto;
    [L2_ASSET_KEYS.l2State]: L2WalletState;
}

@Injectable({
    providedIn: 'root',
})
export class L2AssetsStoreService extends BaseAssetsStoreService<L2AssetStoreData> {
    protected kasplexKrc20Service = inject(KasplexKrc20Service);
    protected krc721ApiService = inject(Krc721ApiService);
    protected knsApiService = inject(KnsApiService);
    protected erc20GraphService = inject(Erc20GraphService);
    protected ethereumWalletChainManager = inject(EthereumWalletChainManager);

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


}