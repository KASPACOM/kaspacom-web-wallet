import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DexApiWalletToken } from './dtos/dex-api-wallet-tokens.interface';
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
    const network = this.ethereumWalletChainManager.getChainConfig(this.ethereumWalletChainManager.getCurrentChainSignal()()!)?.defiApiNetworkName;
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
}
