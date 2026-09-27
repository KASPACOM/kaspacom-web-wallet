import { Injectable, inject } from '@angular/core';
import { UtilsHelper } from './utils.service';
import { KnsApiService } from './kns-api/kns-api.service';
import { firstValueFrom } from 'rxjs';
import { default as Graphemer } from 'graphemer';
import { WalletService } from './wallet.service';
import { KaspaL1NetworkService } from './kaspa-netwrok-services/kaspa-l1-network.service';
import { DotkService } from './dotk/dotk.service';

export interface AddressResolutionResult {
  effectiveAddress: string | null;
  source: 'none' | 'direct' | 'kns' | 'dotk';
  resolvedDomain?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressResolutionService {
  private readonly utils = inject(UtilsHelper);
  private readonly knsApi = inject(KnsApiService);
  private readonly dotkService = inject(DotkService);
  private readonly graphemer = new Graphemer();
  private readonly walletService = inject(WalletService);
  private readonly kaspaL1NetworkService = inject(KaspaL1NetworkService);

  isKaspaAddress(input: string): boolean {
    return this.utils.isValidWalletAddress(input);
  }

  isPotentialDomain(input: string): boolean {
    return (
      this.isPotentialKnsDomain(input) || this.isPotentialDotkDomain(input)
    );
  }

  isPotentialKnsDomain(input: string): boolean {
    if (!input) return false;

    const trimmed = input.trim();

    // Check if it ends with .kas (case insensitive)
    if (!/\.kas$/i.test(trimmed)) {
      return false;
    }

    // Extract the domain part (without .kas)
    const domainPart = trimmed.replace(/\.kas$/i, '');

    // Use graphemer to get proper character count (handles emojis correctly)
    const graphemes = this.graphemer.splitGraphemes(domainPart);

    // Domain must be between 1 and 63 characters (visual length, not string length)
    if (graphemes.length === 0 || graphemes.length > 63) {
      return false;
    }

    // Check for valid characters: letters, numbers, emojis, CJK characters, hyphens, dots
    // But not starting or ending with hyphen, and no consecutive dots
    const validCharPattern =
      /^[a-zA-Z0-9\u{4E00}-\u{9FFF}\u{3400}-\u{4DBF}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{30000}-\u{3134F}\u{1F000}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}.-]+$/u;

    if (!validCharPattern.test(domainPart)) {
      return false;
    }

    // Additional validation: no consecutive dots, no starting/ending with hyphen
    if (
      domainPart.includes('..') ||
      domainPart.startsWith('-') ||
      domainPart.endsWith('-')
    ) {
      return false;
    }

    return true;
  }

  isPotentialDotkDomain(input: string): boolean {
    if (!input) return false;

    const trimmed = input.trim();
    if (!/\.k$/i.test(trimmed)) {
      return false;
    }

    // Dot.K's SDK performs the authoritative name/subname validation. This
    // lightweight check is only for deciding whether the input should enter
    // the asynchronous resolution path instead of address-format validation.
    const name = trimmed.slice(0, -2);
    return name.length > 0 && !/\s/.test(name);
  }

  /**
   * Validate address format and return specific error message if invalid
   */
  validateAddressFormat(input: string): string | null {
    if (!input?.trim()) {
      return null;
    }

    const trimmed = input.trim();

    // If it's a potential domain, we don't validate address format here
    if (this.isPotentialDomain(trimmed)) {
      return null;
    }

    // Check if it's a valid address for the current network
    if (this.isKaspaAddress(trimmed)) {
      return null; // Valid
    }

    // Provide specific error based on network and address format
    const isMainnet = this.kaspaL1NetworkService.isMainnet();
    const expectedPrefix = isMainnet ? 'kaspa:' : 'kaspatest:';
    const wrongPrefix = isMainnet ? 'kaspatest:' : 'kaspa:';

    // Check if using wrong network prefix
    if (trimmed.startsWith(wrongPrefix)) {
      const networkName = isMainnet ? 'mainnet' : 'testnet';
      return `Invalid address format. This is a ${isMainnet ? 'testnet' : 'mainnet'} address, but you're on ${networkName}`;
    }

    // Check if missing prefix entirely
    if (!trimmed.includes(':')) {
      return `Invalid address format. Address should start with '${expectedPrefix}'`;
    }

    // Check if has correct prefix but invalid format
    if (trimmed.startsWith(expectedPrefix)) {
      return `Invalid address format. Please check the address and try again`;
    }

    // General invalid format
    return `Invalid address format. Expected format: ${expectedPrefix}[address]`;
  }

  /**
   * Resolve an input string into a Kaspa address.
   * - If input is already a Kaspa address, returns it immediately.
   * - If input looks like KNS or Dot.K, resolves it through the matching service.
   * - If input appears to be an invalid address format, returns error message.
   * - Otherwise returns null with no error.
   */
  async resolve(input: string): Promise<AddressResolutionResult> {
    const trimmed = (input || '').trim();

    if (!trimmed) {
      return { effectiveAddress: null, source: 'none' };
    }

    // For L1 networks, handle Kaspa addresses and supported name services.
    if (!this.walletService.isL2Display()) {
      if (this.isKaspaAddress(trimmed)) {
        return { effectiveAddress: trimmed, source: 'direct' };
      }

      if (this.isPotentialKnsDomain(trimmed)) {
        // Handle KNS domain resolution
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

      if (this.isPotentialDotkDomain(trimmed)) {
        try {
          const resolution = await this.dotkService.resolveRecipient(trimmed);
          if (resolution.address) {
            return {
              effectiveAddress: resolution.address,
              source: 'dotk',
              resolvedDomain: resolution.display,
            };
          }

          return {
            effectiveAddress: null,
            source: 'dotk',
            resolvedDomain: resolution.display,
            error: resolution.error || 'Dot.K name not found',
          };
        } catch (error) {
          const message =
            error instanceof Error &&
            error.message === 'Dot.K is not supported on the selected network'
              ? error.message
              : 'Failed to resolve Dot.K name';
          return {
            effectiveAddress: null,
            source: 'dotk',
            error: message,
          };
        }
      }

      // Check if input appears to be an invalid address format
      const addressFormatError = this.validateAddressFormat(trimmed);
      if (addressFormatError) {
        return {
          effectiveAddress: null,
          source: 'none',
          error: addressFormatError,
        };
      }
    } else {
      // For L2 networks, handle Ethereum addresses
      if (this.utils.isValidEthereumAddress(trimmed)) {
        return { effectiveAddress: trimmed, source: 'direct' };
      }

      // For L2 networks, we don't support domain resolution yet, so check if it's a valid format
      if (!this.utils.isValidEthereumAddress(trimmed)) {
        return {
          effectiveAddress: null,
          source: 'none',
          error:
            'Invalid Ethereum address format (should start with 0x and be 42 characters long)',
        };
      }
    }

    // Not a valid address for the current network type - no resolution attempted
    return { effectiveAddress: null, source: 'none' };
  }

  private normalizeDomain(input: string): string {
    const lower = input.trim().toLowerCase();
    if (!lower.endsWith('.kas')) {
      return `${lower}.kas`;
    }
    return lower;
  }
}
