import { Injectable, inject } from '@angular/core';
import { UtilsHelper } from './utils.service';
import { KnsApiService } from './kns-api/kns-api.service';
import { firstValueFrom } from 'rxjs';

export interface AddressResolutionResult {
  effectiveAddress: string | null;
  source: 'none' | 'direct' | 'kns';
  resolvedDomain?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressResolutionService {
  private readonly utils = inject(UtilsHelper);
  private readonly knsApi = inject(KnsApiService);

  private static readonly DOMAIN_REGEX =
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(kas|kns)$/i;

  isKaspaAddress(input: string): boolean {
    return this.utils.isValidWalletAddress(input);
  }

  isPotentialDomain(input: string): boolean {
    if (!input) return false;
    return AddressResolutionService.DOMAIN_REGEX.test(input.trim());
  }

  /**
   * Resolve an input string into a Kaspa address.
   * - If input is already a Kaspa address, returns it immediately.
   * - If input looks like a KNS domain (e.g. user.kas or user.kns), attempts to resolve via KNS API.
   * - Otherwise returns null with no error.
   */
  async resolve(input: string): Promise<AddressResolutionResult> {
    const trimmed = (input || '').trim();

    if (!trimmed) {
      return { effectiveAddress: null, source: 'none' };
    }

    if (this.isKaspaAddress(trimmed)) {
      return { effectiveAddress: trimmed, source: 'direct' };
    }

    if (!this.isPotentialDomain(trimmed)) {
      // Not a kaspa address and not a domain; no resolution attempted
      return { effectiveAddress: null, source: 'none' };
    }

    try {
      const normalizedDomain = this.normalizeDomain(trimmed);
      // Use fetchDomainInfo to get asset by domain and take owner address
      const asset = await firstValueFrom(
        this.knsApi.fetchDomainInfo(normalizedDomain),
      );
      if (asset && asset.owner) {
        return {
          effectiveAddress: asset.owner,
          source: 'kns',
          resolvedDomain: normalizedDomain,
        };
      }

      return {
        effectiveAddress: null,
        source: 'kns',
        resolvedDomain: normalizedDomain,
        error: 'Domain not found',
      };
    } catch (error) {
      return {
        effectiveAddress: null,
        source: 'kns',
        error: 'Failed to resolve domain',
      };
    }
  }

  private normalizeDomain(input: string): string {
    const lower = input.trim().toLowerCase();
    if (lower.endsWith('.kns')) {
      return lower.replace(/\.kns$/, '.kas');
    }
    if (!lower.endsWith('.kas')) {
      return `${lower}.kas`;
    }
    return lower;
  }
}
