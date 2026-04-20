import { test, expect } from '@playwright/test';
import { TEST_PASSWORD } from './fixtures/wallet';
import { clearWalletState } from './helpers/storage';
import { createNewWallet, gotoLanding } from './helpers/onboarding';
import { switchToL2 } from './helpers/network';
import { clickKcButton } from './helpers/wait';

test.describe('Token import (ERC20)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await clearWalletState(page);
    await gotoLanding(page);
    await createNewWallet(page, TEST_PASSWORD, 12);
    // ERC20 import only shows on L2. Skip the rest of the test if we
    // can't reach the L2 network-selector (e.g. prod build hides it).
    const networkInfo = page.locator('.network-info').first();
    const hasDevNetworkSelector = await networkInfo
      .isVisible()
      .catch(() => false);
    test.skip(
      !hasDevNetworkSelector,
      'Network selector (dev-mode only) not visible — token import is L2-gated.',
    );
    await switchToL2(page);
  });

  test('@smoke opens import token flow from L2 ERC20 assets', async ({ page }) => {
    // On a fresh L2 wallet the ERC20 tab is the default empty view.
    const importBtn = page
      .locator('kc-button', { hasText: /^\+?\s*Import Token$/ })
      .first();
    await expect(importBtn).toBeVisible({ timeout: 15_000 });
    await importBtn.locator('button').first().click();

    // Import flow rendered — contract address input is the anchor.
    await expect(
      page.locator('.import-token-container').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('kc-button', { hasText: 'Look Up Token' }).first(),
    ).toBeVisible();
  });

  test('@smoke Look Up button stays disabled while address input is empty', async ({
    page,
  }) => {
    const importBtn = page
      .locator('kc-button', { hasText: /^\+?\s*Import Token$/ })
      .first();
    await expect(importBtn).toBeVisible({ timeout: 15_000 });
    await importBtn.locator('button').first().click();

    const lookUpBtn = page
      .locator('kc-button', { hasText: 'Look Up Token' })
      .first()
      .locator('button')
      .first();
    await expect(lookUpBtn).toBeVisible();
    await expect(lookUpBtn).toBeDisabled();
  });

  test('@smoke invalid hex address surfaces an error on look-up', async ({ page }) => {
    const importBtn = page
      .locator('kc-button', { hasText: /^\+?\s*Import Token$/ })
      .first();
    await expect(importBtn).toBeVisible({ timeout: 15_000 });
    await importBtn.locator('button').first().click();

    const addrInput = page
      .locator('.import-token-container .address-input-row kc-input input')
      .first();
    await expect(addrInput).toBeVisible({ timeout: 10_000 });
    await addrInput.fill('this-is-not-a-valid-hex-address');

    await clickKcButton(page, 'Look Up Token');

    // Component sets state='error' which renders invalidReason inside the
    // input. Assert any error-style message shows up near the input.
    const errorText = page
      .locator('.import-token-container')
      .locator('text=/invalid|not valid|enter a valid/i')
      .first();
    await expect(errorText).toBeVisible({ timeout: 10_000 });

    // Token card must NOT have rendered.
    await expect(page.locator('.token-card').first()).not.toBeVisible();
  });
});
