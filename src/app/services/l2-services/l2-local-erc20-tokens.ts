import { inject, Injectable, Signal, signal } from "@angular/core";
import { WalletDB } from "../../db/wallet-db.service";
import { EthereumWalletChainManager } from "../etherium-services/etherium-wallet-chain.manager";
import { Erc20Token } from "@kaspacom/swap-sdk";
import { ethers } from "ethers";


@Injectable({
    providedIn: 'root'
})
export class L2LocalERC20Tokens {
    protected db = inject(WalletDB);
    protected chainManager = inject(EthereumWalletChainManager);
    

    async getAllTokensByChain(chainId: string): Promise<Erc20Token[]> {
        const rows = await this.db.erc20Tokens.where('chainId').equals(chainId).toArray();

        // Same contract may exist under multiple DB keys (legacy lowercase vs checksummed).
        const byNormAddress = new Map<string, Erc20Token>();
        for (const token of rows) {
            let address = token.address;
            try {
                address = ethers.getAddress(token.address);
            } catch {
                // keep stored string if not a valid hex address
            }
            const key = address.toLowerCase();
            byNormAddress.set(key, {
                address,
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,
            });
        }

        return Array.from(byNormAddress.values());
    }

    /** Build all address variants to check/delete for backward compat with legacy stored casings */
    private addressVariants(address: string): string[] {
        const variants = new Set<string>([address, address.toLowerCase()]);
        try {
            variants.add(ethers.getAddress(address));
        } catch {
            // invalid address — ignore
        }
        return Array.from(variants);
    }

    async getToken(tokenAddress: string, chainId: string): Promise<Erc20Token | undefined> {
        // Try all known address variants (checksummed, original, lowercase) so legacy
        // entries stored before address-normalisation are still found.
        for (const variant of this.addressVariants(tokenAddress)) {
            const token = await this.db.erc20Tokens.get([variant, chainId]);
            if (token) return token;
        }
        return undefined;
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
        // Delete all known address variants so legacy entries under different casings are
        // cleaned up too. Dexie.delete is a no-op when the key doesn't exist.
        for (const variant of this.addressVariants(token.address)) {
            await this.db.erc20Tokens.delete([variant, chainId]);
        }
    }
}
