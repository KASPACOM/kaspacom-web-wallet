import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export interface Kcc20TransferActionDraft {
  tokenAmount: string;
  recipientOwner: string;
  /** Kaspa wallet address that will sign and fund the PSKT. */
  walletAddress: string;
}

/**
 * Trimmed to only the fields this wallet actually reads out of the KCC20
 * backend's wallet-operation manifest — the full shape (kcc20-frontend's
 * Kcc20WalletOperationManifest) also carries deploy/mint/order bookkeeping
 * this wallet doesn't build.
 */
export interface Kcc20WalletOperationResponse {
  requestId: string;
  payload: {
    signing?: {
      status: 'missing-funded-pskt' | 'ready-to-sign';
      psktTransactionJson?: string;
      signInputs?: Array<{ index: number; sighashType?: number }>;
      scripts?: Array<{
        inputIndex: number;
        scriptHex: string;
        signType?: number;
        signatureScript?: {
          mode: 'wrap-signature' | 'signature-first-args' | 'ordered-args';
          args?: Array<
            | { type: 'i64'; value: string | number }
            | { type: 'data'; hex: string }
            | { type: 'byte'; value: number }
            | { type: 'signature'; prefixHex?: string }
          >;
        };
      }>;
      submitTransactionSupported?: boolean;
      builderError?: string;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class Kcc20TokenActionApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private get baseUrl(): string {
    const baseUrl = this.kaspaL1NetworkService.getKcc20ApiBaseurl();
    if (!baseUrl) {
      throw new Error('KCC20 is not available on this network.');
    }
    return baseUrl.replace(/\/+$/, '');
  }

  /**
   * Uses the public builder (`/kcc20/build/tokens/:covenantId/transfer`)
   * rather than the session-authenticated `/tokens/:covenantId/actions/transfer/build`
   * — the latter requires a KCC20 backend cookie session (OTP + wallet-sign-in),
   * which is cross-origin from this app and 401s when that session cookie
   * isn't present. The public builder needs no session; it just takes the
   * sender's wallet address directly in the request body.
   */
  async buildTransfer(
    covenantId: string,
    draft: Kcc20TransferActionDraft,
  ): Promise<Kcc20WalletOperationResponse> {
    return firstValueFrom(
      this.httpClient.post<Kcc20WalletOperationResponse>(
        `${this.baseUrl}/kcc20/build/tokens/${covenantId}/transfer`,
        draft,
      ),
    );
  }
}
