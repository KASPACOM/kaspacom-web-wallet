import { Page, test } from '@playwright/test';
import { getFundedSeed, TEST_PASSWORD } from '../fixtures/wallet';
import { gotoLanding, importBySeedPhrase } from './onboarding';
import { clearWalletState } from './storage';

/**
 * Drive the import UI with the pre-funded TN10 seed from `KASPA_E2E_SEED`
 * (set as a KASPACOM GitHub Actions organization secret). Skips the test if
 * the env var is unset so forks / local runs without the secret don't fail
 * loudly.
 *
 * Returns the password used, so callers can reuse it for subsequent locks.
 */
export async function authenticateFundedWallet(page: Page): Promise<string> {
  const seed = getFundedSeed();
  test.skip(!seed, 'KASPA_E2E_SEED not set — funded-wallet tests require the pre-funded TN10 seed');

  await clearWalletState(page);
  await gotoLanding(page);
  await importBySeedPhrase(page, seed!, TEST_PASSWORD);
  return TEST_PASSWORD;
}
