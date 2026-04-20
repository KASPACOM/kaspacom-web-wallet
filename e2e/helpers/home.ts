import { Page, expect } from '@playwright/test';

function parseBalanceText(raw: string): number {
  const normalized = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse the rendered KAS balance from the balance component. Waits until
 * the skeleton clears, then — if the initial value is 0 — polls for up to
 * `waitForNonZeroMs` to accommodate the UTXO fetch that populates the
 * balance asynchronously after login.
 *
 * Returns NaN only when the text never parses; returns 0 when the wallet
 * truly holds nothing (poll deadline exceeded).
 */
export async function readKasBalance(
  page: Page,
  opts: { waitForNonZeroMs?: number } = {},
): Promise<number> {
  const waitForNonZeroMs = opts.waitForNonZeroMs ?? 45_000;
  const amount = page.locator('.balance-amount').first();
  await expect(amount).toBeVisible({ timeout: 30_000 });

  const deadline = Date.now() + waitForNonZeroMs;
  let last = NaN;
  while (Date.now() < deadline) {
    const raw = (await amount.textContent())?.trim() ?? '';
    last = parseBalanceText(raw);
    if (Number.isFinite(last) && last > 0) return last;
    await page.waitForTimeout(2_000);
  }
  return last;
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
