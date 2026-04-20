import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DexApiWalletToken } from './dtos/dex-api-wallet-tokens.interface';
import { DexApiToken, DexApiTokensResponse } from './dtos/dex-api-tokens.interface';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';


const DEX_CONTROLLER = 'dex';

@Injectable({ providedIn: 'root' })
export class KaspaComDefiApiService {
  baseurl = environment.kaspaComDefiApiBaseurl;

  constructor(private readonly httpClient: HttpClient, private readonly ethereumWalletChainManager: EthereumWalletChainManager) { }

  private buildHttpParamsWithNetwork(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: Record<string, any>,
  ): HttpParams {
    const config = this.ethereumWalletChainManager.getChainConfig(this.ethereumWalletChainManager.getCurrentChainSignal()()!);
    const network = config?.defiApiNetworkName || config?.chainName;
    return this.buildHttpParams({ ...params, network });
  }

  private buildHttpParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return httpParams;
  }

  /**
   * GET /dex/wallet-tokens/:walletAddress
   * Get tokens of a wallet from backend
   */
  getWalletTokensBalances(
    walletAddress: string,
  ): Promise<DexApiWalletToken[]> {
    const params = this.buildHttpParamsWithNetwork();
    return firstValueFrom(
      this.httpClient.get<DexApiWalletToken[]>(
        `${this.baseurl}/${DEX_CONTROLLER}/wallet-tokens/${walletAddress}`,
        { params },
      ),
    );
  }

  /**
   * GET /dex/tokens
   * Returns all tokens on the current network with price/marketcap info.
   * Wallet-tokens endpoint does not include price — callers merge by address.
   */
  async getTokens(): Promise<DexApiToken[]> {
    const params = this.buildHttpParamsWithNetwork();
    const response = await firstValueFrom(
      this.httpClient.get<DexApiTokensResponse>(
        `${this.baseurl}/${DEX_CONTROLLER}/tokens`,
        { params },
      ),
    );
    return response?.tokens ?? [];
  }
}
