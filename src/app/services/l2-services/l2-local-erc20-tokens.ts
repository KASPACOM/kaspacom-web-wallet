import { inject, Injectable, Signal, signal } from "@angular/core";
import { WalletDB } from "../../db/wallet-db.service";
import { EthereumWalletChainManager } from "../etherium-services/etherium-wallet-chain.manager";
import { Erc20Token } from "@kaspacom/swap-sdk";


@Injectable({
    providedIn: 'root'
})
export class L2LocalERC20Tokens {
    protected db = inject(WalletDB);
    protected chainManager = inject(EthereumWalletChainManager);
    

    async getAllTokensByChain(chainId: string): Promise<Erc20Token[]> {
        const tokens = await this.db.erc20Tokens.where('chainId').equals(chainId).toArray();

        return tokens.map((token) => {
            return {
                address: token.address,
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,
            };
        });
    }

    async getToken(tokenAddress: string, chainId: string): Promise<Erc20Token | undefined> {
        const token = await this.db.erc20Tokens.get([tokenAddress, chainId]);
        return token;
    }

    async addToken(token: Erc20Token, chainId: string) {
        await this.db.erc20Tokens.add({
            address: token.address,
            chainId: chainId,
            decimals: token.decimals,
            name: token.name,
            symbol: token.symbol,
        });
    }

    async removeToken(token: Erc20Token, chainId: string) {
        await this.db.erc20Tokens.delete([token.address, chainId]);
    }
}