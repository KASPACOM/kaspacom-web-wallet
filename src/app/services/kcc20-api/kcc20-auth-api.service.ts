import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export interface Kcc20OtpResponse {
  success: boolean;
  code: string;
}

export interface Kcc20SignInRequest {
  walletAddress: string;
  signature: string;
  date: string;
  requestId: string;
  publicKey: string;
}

export interface Kcc20AuthWalletInfo {
  success: boolean;
  walletAddress: string;
  authType?: string;
  kcc20Owner: string;
}

/**
 * Auth for the KCC20 backend: OTP + signed-message login, matching
 * kcc20-frontend's own Kcc20AuthApiService exactly (same 3 endpoints). The
 * backend sets an HTTP-only session cookie on sign-in — this service never
 * reads or stores a token itself, only `withCredentials: true` per call.
 */
@Injectable({ providedIn: 'root' })
export class Kcc20AuthApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private get baseUrl(): string | undefined {
    return this.kaspaL1NetworkService.getKcc20ApiBaseurl();
  }

  private requireBaseUrl(): string {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      throw new Error('KCC20 is not available on this network.');
    }
    return baseUrl.replace(/\/+$/, '');
  }

  async requestOtp(walletAddress: string): Promise<Kcc20OtpResponse> {
    return firstValueFrom(
      this.httpClient.post<Kcc20OtpResponse>(
        `${this.requireBaseUrl()}/auth/otp`,
        { walletAddress },
        { withCredentials: true },
      ),
    );
  }

  async signIn(dto: Kcc20SignInRequest): Promise<Kcc20AuthWalletInfo> {
    return firstValueFrom(
      this.httpClient.post<Kcc20AuthWalletInfo>(
        `${this.requireBaseUrl()}/auth/wallet-sign-in`,
        dto,
        { withCredentials: true },
      ),
    );
  }

  async getInfo(): Promise<Kcc20AuthWalletInfo | undefined> {
    try {
      return await firstValueFrom(
        this.httpClient.get<Kcc20AuthWalletInfo>(
          `${this.requireBaseUrl()}/auth/info`,
          { withCredentials: true },
        ),
      );
    } catch {
      return undefined;
    }
  }
}
