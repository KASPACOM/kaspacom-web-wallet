import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { KASPA_NETWORKS } from '../config/consts';

const WALLET_ADDRESS_VALIDATION_REGEX_MAINNET = /^kaspa:(q|p)[a-z0-9]{54,90}$/;
const WALLET_ADDRESS_VALIDATION_REGEX_TESTNET =
  /^kaspatest:(q|p)[a-z0-9]{54,90}$/;

@Injectable({
  providedIn: 'root',
})
export class UtilsHelper {
  async retryOnError<T>(
    fn: () => Promise<T>,
    times: number = 5,
    waitBeforeNextAttempt = 1000,
    skipLog: boolean = false,
    stopFunction?: (error: any) => boolean,
  ): Promise<T> {
    let attempt = 0;
    let lastError: any = null;

    while (attempt < times) {
      try {
        return await fn();
      } catch (error) {
        if (stopFunction && stopFunction(error)) {
          throw error;
        }
        attempt++;

        if (!skipLog) {
          console.log(`retryOnError: Error on attempt ${attempt} of ${times}`);
          console.log(error);
        }

        if (waitBeforeNextAttempt) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitBeforeNextAttempt),
          );
        }

        lastError = error;
      }
    }

    throw lastError;
  }

  isNullOrEmptyString(str: string | undefined | null): boolean {
    return !str || str.trim().length === 0;
  }

  isNumberString(str: string): boolean {
    return /^\d+(\.\d+)?$/.test(str);
  }

  isValidWalletAddress(address: string) {
    const regex =
      environment.kaspaNetwork == KASPA_NETWORKS.MAINNET
        ? WALLET_ADDRESS_VALIDATION_REGEX_MAINNET
        : WALLET_ADDRESS_VALIDATION_REGEX_TESTNET;

    return regex.test(address);
  }

  /**
   * Validates Ethereum address format (0x followed by 40 hexadecimal characters)
   */
  isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validates address based on current network type (L1 Kaspa vs L2 Ethereum)
   */
  isValidAddressForNetwork(address: string, isL2Network: boolean): boolean {
    return isL2Network
      ? this.isValidEthereumAddress(address)
      : this.isValidWalletAddress(address);
  }

  /**
   * Get appropriate error message for invalid address based on network
   */
  getAddressValidationErrorMessage(
    address: string,
    isL2Network: boolean,
  ): string {
    if (!address?.trim()) {
      return 'Wallet address is required';
    }

    if (isL2Network) {
      if (!this.isValidEthereumAddress(address)) {
        return 'Invalid Ethereum address format (should start with 0x and be 42 characters long)';
      }
    } else {
      if (!this.isValidWalletAddress(address)) {
        const expectedPrefix =
          environment.kaspaNetwork === KASPA_NETWORKS.MAINNET
            ? 'kaspa:'
            : 'kaspatest:';
        return `Invalid Kaspa address format. Expected format: ${expectedPrefix}[address]`;
      }
    }

    return '';
  }

  stringifyWithBigInt(obj: any) {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value,
    );
  }

  parseWithBigInt(jsonString: any) {
    return JSON.parse(jsonString, (key, value) =>
      typeof value === 'string' && /^\d+n$/.test(value)
        ? BigInt(value.slice(0, -1))
        : value,
    );
  }

  stringifyProtocolAction(action: any) {
    return JSON.stringify(action, null, 0);
  }

  shortenAddress(
    address: string,
    frontChars: number = 15,
    backChars: number = 4,
  ): string {
    if (!address || address.length <= frontChars + backChars) {
      return address;
    }
    return `${address.slice(0, frontChars)}...${address.slice(-backChars)}`;
  }
}
