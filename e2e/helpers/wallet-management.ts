import { Page, expect } from '@playwright/test';
import { waitForWalletHome } from './wait';

/**
 * Open the wallet-management flow from the header's profile container.
 * Starts from /app/home.
 */
export async function openWalletManagement(page: Page): Promise<void> {
  await waitForWalletHome(page);
  const profile = page.locator('.profile-container').first();
  await expect(profile).toBeVisible({ timeout: 10_000 });
  await profile.click();

  // Wallet management renders a list of .wallet-item rows; wait for at
  // least one to appear (the current wallet must already be there).
  await expect(page.locator('.wallet-item').first()).toBeVisible({
    timeout: 10_000,
  });
}
