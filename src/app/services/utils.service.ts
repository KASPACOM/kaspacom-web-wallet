import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { KASPA_NETWORKS } from '../config/consts';

const WALLET_ADDRESS_VALIDATION_REGEX_MAINNET = /^kaspa:(q|p)[a-z0-9]{54,90}$/;
const WALLET_ADDRESS_VALIDATION_REGEX_TESTNET = /^kaspatest:(q|p)[a-z0-9]{54,90}$/;

@Injectable({
  providedIn: 'root',
})
export class UtilsHelper {
  async retryOnError<T>(
    fn: () => Promise<T>,
    times: number = 5,
    waitBeforeNextAttempt = 1000,
    skipLog: boolean = false,
    stopFunction?: (error: any) => boolean
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
            setTimeout(resolve, waitBeforeNextAttempt)
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
    const regex = environment.kaspaNetwork == KASPA_NETWORKS.MAINNET ? WALLET_ADDRESS_VALIDATION_REGEX_MAINNET : WALLET_ADDRESS_VALIDATION_REGEX_TESTNET;

    return regex.test(address);
  }

}
