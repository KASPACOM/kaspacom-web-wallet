import { Page, expect } from '@playwright/test';
import { waitForWalletHome } from './wait';

/**
 * Open the settings menu overlay from the wallet home screen.
 * Assumes the caller has already landed on /app/home.
 */
export async function openSettings(page: Page): Promise<void> {
  await waitForWalletHome(page);
  const settingsIcon = page.locator('kc-icon[iconClass="icon-settings"]').first();
  await expect(settingsIcon).toBeVisible({ timeout: 10_000 });
  await settingsIcon.click();
  // Settings menu is an overlay — wait for its container to attach.
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
