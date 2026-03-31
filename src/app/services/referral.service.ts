import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const REFERRAL_STORAGE_KEY = 'kc-ref-code';

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = environment.kaspaComDefiApiBaseurl;

  /**
   * Capture ?ref= query parameter from the URL, store in localStorage,
   * and clean the URL without triggering a reload.
   */
  captureReferralCode(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && ref.trim()) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim().toLowerCase());

        // Remove ?ref= from URL without reload
        params.delete('ref');
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? '?' + newSearch : '') +
          window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
    } catch (error) {
      console.error('ReferralService: Failed to capture referral code', error);
    }
  }

  /**
   * Register wallet with referral system. Call after wallet creation/import.
   * Silent fail — never blocks the wallet flow.
   */
  async registerWallet(walletAddress: string): Promise<void> {
    try {
      const refCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
      const body: Record<string, string> = refCode
        ? { referredBy: refCode }
        : {};

      await firstValueFrom(
        this.httpClient.post(
          `${this.baseUrl}/user-referrals/user-referral?walletAddress=${encodeURIComponent(walletAddress)}`,
          body,
        ),
      );

      // Clear referral code on success
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch (error) {
      // Silent fail — don't block wallet creation flow
      console.error(
        'ReferralService: Failed to register wallet referral',
        error,
      );
    }
  }
}
