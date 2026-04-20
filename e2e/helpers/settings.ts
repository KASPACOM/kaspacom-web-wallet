import { Page, expect } from '@playwright/test';
import { waitForWalletHome } from './wait';

/**
 * Open the settings menu overlay from the wallet home screen.
 * Assumes the caller has already landed on /app/home.
 */
export async function openSettings(page: Page): Promise<void> {
  await waitForWalletHome(page);
  // wrapper-header binds `[iconClass]="'icon-settings'"` as an Angular input,
  // which is NOT reflected to a DOM attribute. Use the stable CSS class on
  // the host (`.settings-icon`) plus the (click) handler on kc-icon itself.
  const settingsIcon = page.locator('kc-icon.settings-icon').first();
  await expect(settingsIcon).toBeVisible({ timeout: 10_000 });
  await settingsIcon.click();
  await expect(page.locator('.settings-menu-container').first()).toBeVisible({
    timeout: 10_000,
  });
}

export async function closeSettings(page: Page): Promise<void> {
  const container = page.locator('.settings-menu-container').first();
  if (await container.isVisible().catch(() => false)) {
    // Click outside or press Escape to close.
    await page.keyboard.press('Escape');
    await container.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
  }
}
