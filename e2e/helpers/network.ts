import { Page, expect } from '@playwright/test';
import { waitForWalletHome } from './wait';

/**
 * Switch the wallet display to an L2 network (Kasplex testnet by default).
 * Opens the network-selection overlay from the wrapper header and clicks
 * the matching item. Only available in development builds — the selector
 * is gated by `isDevelopmentMode()` in wrapper-header.component.ts.
 */
export async function switchToL2(
  page: Page,
  networkName: RegExp | string = /Kasplex/i,
): Promise<void> {
  await waitForWalletHome(page);
  const networkInfo = page.locator('.network-info').first();
  await expect(networkInfo).toBeVisible({ timeout: 10_000 });
  await networkInfo.click();

  await expect(page.locator('.network-selection-modal').first()).toBeVisible({
    timeout: 5_000,
  });

  const target = page
    .locator('.network-item', { hasText: networkName })
    .first();
  await expect(target).toBeVisible({ timeout: 5_000 });
  await target.click();

  // After selection the component navigates back to /app/home.
  await page
    .locator('.network-selection-modal')
    .waitFor({ state: 'detached', timeout: 5_000 })
    .catch(() => {});
}
