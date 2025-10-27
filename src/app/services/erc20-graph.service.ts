import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Erc20Token } from "@kaspacom/swap-sdk";
import { EthereumWalletChainManager } from "./etherium-services/etherium-wallet-chain.manager";
import { firstValueFrom } from "rxjs";
import { ethers } from "ethers";

export interface UserBalanceGraphToken {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
}

export interface GraphBalance {
    value: string;
    token: UserBalanceGraphToken;
}

export interface UserBalanceGraphAccount {
    id: string;
    balances: GraphBalance[];
}

export interface UserBalanceGraphResponse {
    data: {
        account: UserBalanceGraphAccount | null;
    };
}


@Injectable({ providedIn: 'root' })
export class Erc20GraphService {
    protected httpClient = inject(HttpClient);
    protected ethereumWalletChainManager = inject(EthereumWalletChainManager);
    constructor() {}

    
    async getBalances(walletAddress: string, chain: string): Promise<Erc20Token[]> {
        const query = `
    {
        account(id: "${walletAddress.toLowerCase()}") {
          id
          balances(where: { value_gt: 0 }) {
            value
            token {
              id
              symbol
              name
              decimals
            }
          }
        }
      }`;

      const networkConfig = this.ethereumWalletChainManager.getChainEnvConfig(chain);
        const graphUrl = networkConfig?.erc20GraphUrl;

        if (!graphUrl) {
            throw new Error('Graph url not found');
        }

        const response = await firstValueFrom(this.httpClient.post<UserBalanceGraphResponse>(
            graphUrl,
            { query },
            { headers: { "Content-Type": "application/json" } }
        ));

        const balances = response.data?.account?.balances ?? [];

        return balances.map((b: any) => {
            const decimals = Number(b.token.decimals);
            const rawBalance = b.value;

            return {
                address: b.token.id,
                symbol: b.token.symbol,
                name: b.token.name,
                decimals: Number(b.token.decimals),
                rawBalance,
                balance: parseFloat(ethers.formatUnits(rawBalance, decimals)),
            };
        });
    }
}
