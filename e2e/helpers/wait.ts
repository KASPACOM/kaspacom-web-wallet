import { Page, expect, Locator } from '@playwright/test';

/**
 * Wait for the onboarding-v2 root panel transition (welcome → create → import).
 * Best-effort; the class may detach before we observe it.
 */
export async function waitForRootTransition(page: Page): Promise<void> {
  await page
    .locator('.onboarding-v2__panel-content--transitioning')
    .waitFor({ state: 'detached', timeout: 3_000 })
    .catch(() => {
      /* already gone */
    });
}

/**
 * Click a kc-button whose `[text]` input matches `text`. The web component
 * forwards the click to an inner native button, so we locate the nested
 * button to sidestep any host-level click listeners.
 */
export async function clickKcButton(page: Page, text: string): Promise<void> {
  const btn = page.locator(`kc-button:has-text("${text}")`).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  const innerBtn = btn.locator('button').first();
  const count = await innerBtn.count();
  if (count > 0) {
    await innerBtn.click();
  } else {
    await btn.click();
  }
}

/**
 * Wait until a heading with the given text appears — a stable signal that
 * we have transitioned to the expected onboarding step.
 */
export async function waitForHeading(
  page: Page,
  text: string | RegExp,
  timeout = 15_000,
): Promise<Locator> {
  const heading = page.locator('span.typo-title-3', { hasText: text }).first();
  await expect(heading).toBeVisible({ timeout });
  return heading;
}

/**
 * Wait until the wallet home hydrates (URL + balance value present).
 */
export async function waitForWalletHome(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 45_000 });
  await expect(page.locator('.balance-container__value').first()).toBeVisible({
    timeout: 30_000,
  });
}
