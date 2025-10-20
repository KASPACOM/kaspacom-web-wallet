import { inject, Injectable } from "@angular/core";
import { BaseAssetsStoreService, BaseAssetStoreData } from "./base-assets-store.service";
import { GetTokenListDto, GetTokenListResponse } from "../../kasplex-api/dtos/token-list-info.dto";
import { Krc721Nft } from "../../krc721-api/dtos/krc721-nft.dto";
import { KnsDomainAsset } from "../../kns-api/dtos/kns-domain.dto";
import { firstValueFrom } from "rxjs";
import { KasplexKrc20Service } from "../../kasplex-api/kasplex-api.service";
import { Krc721ApiService } from "../../krc721-api/krc721-api.service";
import { KnsApiService } from "../../kns-api/kns-api.service";

export const L1_ASSET_KEYS = {
    krc20: 'krc20',
    krc721: 'krc721',
    kns: 'kns',
}

export interface L1AssetStoreData extends BaseAssetStoreData {
    [L1_ASSET_KEYS.krc20]: GetTokenListDto;
    [L1_ASSET_KEYS.krc721]: Krc721Nft;
    [L1_ASSET_KEYS.kns]: KnsDomainAsset;
}

@Injectable({
    providedIn: 'root',
})
export class L1AssetsStoreService extends BaseAssetsStoreService<L1AssetStoreData> {
    protected kasplexKrc20Service = inject(KasplexKrc20Service);
    protected krc721ApiService = inject(Krc721ApiService);
    protected knsApiService = inject(KnsApiService);
    


    constructor() {
        super();
    }

    protected override getLoadFunctionAssetsNames(): { [K in keyof L1AssetStoreData]: string } {
        return {
            kns: 'getKnsInfo',
            krc20: 'getKrc20Info',
            krc721: 'getKrc721Info',
        }
    }

    /**
     * Reload KRC20 tokens with pagination
     */
    protected async getKrc20Info(walletAddress: string): Promise<GetTokenListDto[]> {
        const allTokens: GetTokenListDto[] = [];
        let paginationKey: string | null = null;
        let pageCount = 0;

        // Load all pages
        do {
            const response: GetTokenListResponse = await firstValueFrom(
                this.kasplexKrc20Service.getWalletTokenList(
                    walletAddress,
                    paginationKey,
                    paginationKey ? 'next' : null,
                ),
            );

            if (response.result && response.result.length > 0) {
                const tokens: GetTokenListDto[] = response.result.map(
                    (token) => ({
                        tick: token.tick,
                        balance:
                            parseFloat(token.balance) /
                            Math.pow(10, parseInt(token.dec)),
                        locked:
                            parseFloat(token.locked) /
                            Math.pow(10, parseInt(token.dec)),
                        decimals: parseInt(token.dec),
                        opScoreMod: token.opScoreMod,
                    }),
                );

                allTokens.push(...tokens);
                pageCount++;
            }

            paginationKey = response.next;
        } while (paginationKey);

        return allTokens;
    }

    /**
     * Reload KRC721 NFTs
     */
    protected async getKrc721Info(walletAddress: string): Promise<Krc721Nft[]> {
        // Call API without pagination parameters (like the original implementation)
        const response = await firstValueFrom(
            this.krc721ApiService.getAddressNfts(
                walletAddress,
            ),
        );

        if (response.message === 'success' && response.result) {
            return response.result;
        } else {
            throw new Error('KRC721 API response not successful');
        }
    }

    /**
     * Reload KNS domains with pagination
     */
    protected async getKnsInfo(walletAddress: string): Promise<KnsDomainAsset[]> {
        return await this.knsApiService.getAllWalletDomains(
            walletAddress,
        );
    }

}