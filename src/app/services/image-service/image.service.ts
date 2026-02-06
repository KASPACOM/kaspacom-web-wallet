import { inject, Inject, Injectable } from '@angular/core';
import { DEFI_API_BASE_URL } from '../../config/injection-tokens';
import { HttpClient, HttpParams } from '@angular/common/http';
import { LfgTokenResponse } from '../../types/lfg-token.model';
import { Observable } from 'rxjs';
import { TokenLogoResponse } from '../../types/token-response.model';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { EthereumWalletChainManager } from '../etherium-services/etherium-wallet-chain.manager';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private readonly http = inject(HttpClient);
  private readonly ethereumWalletChainManager = inject(EthereumWalletChainManager);

  private readonly EXPLORER_CONTROLLER = 'explorer';
  private readonly DEX_CONTROLLER = 'dex';

  constructor(@Inject(DEFI_API_BASE_URL) private baseUrl: string) {}

  /**
   * GET /explorer/lfg-tokens
   * Get LFG tokens from backend (proxies https://api.lfg.kaspa.com/tokens/dex)
   */
  getLfgTokens(): Observable<LfgTokenResponse> {
    return this.http.get<LfgTokenResponse>(
      `${this.baseUrl}/${this.EXPLORER_CONTROLLER}/lfg-tokens`,
    );
  }

  /**
   * GET /dex/token/:tokenAddress/logo
   * Get token logo URL
   */
  getLogoUrl(tokenAddress: string): Observable<TokenLogoResponse> {
    // Intentionally do NOT swallow errors here:
    // callers (e.g. firstValueFrom) rely on HTTP failures rejecting.
    const params = this.buildHttpParamsWithNetwork();
    return this.http.get<TokenLogoResponse>(
      `${this.baseUrl}/${this.DEX_CONTROLLER}/token/${tokenAddress}/logo`,
      { params },
    );
  }

  /**
   * Wrapper around buildHttpParams that automatically includes the current network
   * from NetworkContextService as a network parameter.
   *
   * @param params - Optional parameters to include in the HttpParams
   * @returns HttpParams with all provided parameters plus the current network
   */
  private buildHttpParamsWithNetwork(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: Record<string, any>,
  ): HttpParams {
    const config = this.ethereumWalletChainManager.getChainConfig(this.ethereumWalletChainManager.getCurrentChainSignal()()!);
    const network = config?.defiApiNetworkName || config?.chainName;

    return this.buildHttpParams({ ...params, network });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildHttpParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return httpParams;
  }
}
