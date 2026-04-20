import { Page, expect } from '@playwright/test';

/**
 * Parse the rendered KAS balance from the balance component. Waits until
 * the skeleton has cleared and the `.balance-amount` text is visible, then
 * strips commas and returns the numeric value.
 *
 * Returns NaN when the text doesn't parse (caller should treat as 'unknown'
 * rather than 'zero').
 */
export async function readKasBalance(page: Page): Promise<number> {
  const amount = page.locator('.balance-amount').first();
  await expect(amount).toBeVisible({ timeout: 30_000 });
  const raw = (await amount.textContent())?.trim() ?? '';
  const normalized = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Read the current wallet's full address by clicking the copy button in
 * the balance component, then reading the clipboard.
 *
 * Requires `clipboard-read` permission on the browser context — tests
 * should grant it via `context.grantPermissions(['clipboard-read'])`
 * before calling this.
 */
export async function readWalletAddress(page: Page): Promise<string> {
  const display = page.locator('.wallet-address-display').first();
  await expect(display).toBeVisible({ timeout: 30_000 });
  const copyBtn = display.locator('app-copy-button').first();
  await copyBtn.click();
  // Small debounce — clipboard write is synchronous but Chromium schedules
  // the clipboard-change event on a microtask; 200ms is comfortably safe.
  await page.waitForTimeout(200);
  const address = await page.evaluate(() => navigator.clipboard.readText());
  return address.trim();
}
