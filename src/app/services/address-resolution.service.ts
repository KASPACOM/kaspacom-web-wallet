import { Injectable, inject } from '@angular/core';
import { UtilsHelper } from './utils.service';
import { KnsApiService } from './kns-api/kns-api.service';
import { firstValueFrom } from 'rxjs';
import { default as Graphemer } from 'graphemer';

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
  private readonly graphemer = new Graphemer();

  isKaspaAddress(input: string): boolean {
    return this.utils.isValidWalletAddress(input);
  }

  isPotentialDomain(input: string): boolean {
    if (!input) return false;
    
    const trimmed = input.trim();
    
    // Check if it ends with .kas or .kns (case insensitive)
    if (!/\.(kas|kns)$/i.test(trimmed)) {
      return false;
    }
    
    // Extract the domain part (without .kas or .kns)
    const domainPart = trimmed.replace(/\.(kas|kns)$/i, '');
    
    // Use graphemer to get proper character count (handles emojis correctly)
    const graphemes = this.graphemer.splitGraphemes(domainPart);
    
    // Domain must be between 1 and 63 characters (visual length, not string length)
    if (graphemes.length === 0 || graphemes.length > 63) {
      return false;
    }
    
    // Check for valid characters: letters, numbers, emojis, CJK characters, hyphens, dots
    // But not starting or ending with hyphen, and no consecutive dots
    const validCharPattern = /^[a-zA-Z0-9\u{4E00}-\u{9FFF}\u{3400}-\u{4DBF}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{30000}-\u{3134F}\u{1F000}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}.-]+$/u;
    
    if (!validCharPattern.test(domainPart)) {
      return false;
    }
    
    // Additional validation: no consecutive dots, no starting/ending with hyphen
    if (domainPart.includes('..') || domainPart.startsWith('-') || domainPart.endsWith('-')) {
      return false;
    }
    
    return true;
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
