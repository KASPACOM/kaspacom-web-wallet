import { Page, expect } from '@playwright/test';

/**
 * Wait for the 600ms step transition animation to finish before interacting
 * with the next step's controls.
 */
export async function waitForStepTransition(page: Page): Promise<void> {
  await page
    .locator('.onboarding-v2__panel-content--transitioning')
    .waitFor({ state: 'detached', timeout: 5_000 })
    .catch(() => {
      /* class may already be gone */
    });
}

/**
 * Wait until the balance component has hydrated (skeleton gone, value visible).
 */
export async function waitForWalletHome(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 20_000 });
  await expect(page.locator('.balance-container__value').first()).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Click a kc-button whose `[text]` input matches the given label.
 * The web component renders a nested native <button>, so we target the host
 * and let Playwright forward the click.
 */
export async function clickKcButton(page: Page, text: string): Promise<void> {
  const btn = page.locator(`kc-button:has-text("${text}")`).first();
  await expect(btn).toBeVisible();
  await expect(btn).not.toHaveAttribute('isdisabled', 'true');
  await btn.click();
}
