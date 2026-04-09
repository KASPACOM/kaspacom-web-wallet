import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DEFI_API_BASE_URL } from '../config/injection-tokens';
import { LOCAL_STORAGE_KEYS } from '../config/consts';

export const REFERRAL_STORAGE_KEY = LOCAL_STORAGE_KEYS.REFERRAL_CODE;
const LEGACY_REFERRAL_STORAGE_KEY = LOCAL_STORAGE_KEYS.LEGACY_REFERRAL_CODE;
/** Referral codes are short slugs; cap size and charset before localStorage / API. */
const REF_CODE_MAX_LENGTH = 64;
const REF_CODE_PATTERN = /^[a-z0-9_-]+$/;

function isValidRefCode(normalized: string): boolean {
  return (
    normalized.length > 0 &&
    normalized.length <= REF_CODE_MAX_LENGTH &&
    REF_CODE_PATTERN.test(normalized)
  );
}

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = inject(DEFI_API_BASE_URL);

  /**
   * Capture ?ref= query parameter from the URL, store in localStorage,
   * and clean the URL without triggering a reload.
   */
  captureReferralCode(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (!ref) {
        return;
      }
      const normalized = ref.trim().toLowerCase();
      if (!isValidRefCode(normalized)) {
        return;
      }

      // Persist to storage (best-effort — URL cleanup must still happen)
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
      } catch (storageErr) {
        if (!environment.isProduction) {
          console.error('ReferralService: Failed to persist referral code', storageErr);
        }
      }

      // Remove ?ref= from URL without reload
      params.delete('ref');
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname +
        (newSearch ? '?' + newSearch : '') +
        window.location.hash;
      window.history.replaceState(window.history.state, '', newUrl);
    } catch (err) {
      if (!environment.isProduction) {
        console.error('ReferralService: Failed to capture referral code', err);
      }
    }
  }

  /**
   * Register wallet with referral system. Call after wallet creation/import.
   * Silent fail — never blocks the wallet flow.
   */
  async registerWallet(walletAddress: string): Promise<void> {
    try {
      // Read referral code from storage (best-effort)
      let storedRefCode = '';
      let hasLegacy = false;
      try {
        storedRefCode = localStorage.getItem(REFERRAL_STORAGE_KEY) ?? '';
        if (!storedRefCode) {
          const legacyCode = localStorage.getItem(LEGACY_REFERRAL_STORAGE_KEY);
          if (legacyCode) {
            const normalizedLegacy = legacyCode.trim().toLowerCase();
            if (isValidRefCode(normalizedLegacy)) {
              storedRefCode = normalizedLegacy;
              hasLegacy = true;
              // Migrate legacy key to new key (canonical form)
              localStorage.setItem(REFERRAL_STORAGE_KEY, normalizedLegacy);
            } else {
              // Invalid legacy code — remove it immediately and don't migrate
              localStorage.removeItem(LEGACY_REFERRAL_STORAGE_KEY);
            }
          }
        }
      } catch {
        // Storage read is best-effort; proceed with empty body
      }

      const normalizedRefCode = storedRefCode.trim().toLowerCase();
      const body: Record<string, string> = isValidRefCode(normalizedRefCode)
        ? { referredBy: normalizedRefCode }
        : {};

      await firstValueFrom(
        this.httpClient.post(
          `${this.baseUrl}/user-referrals/user-referral?walletAddress=${encodeURIComponent(walletAddress)}`,
          body,
        ),
      );

      // Clear referral code on success
      try {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        if (hasLegacy) {
          localStorage.removeItem(LEGACY_REFERRAL_STORAGE_KEY);
        }
      } catch {
        // Best-effort cleanup
      }
    } catch (err) {
      if (!environment.isProduction) {
        console.error(
          'ReferralService: Failed to register wallet referral',
          err,
        );
      }
    }
  }
}
