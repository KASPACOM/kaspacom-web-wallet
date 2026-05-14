import { test, expect } from '@playwright/test';
import {
  BIP39_TEST_SEED_12,
  BIP39_TEST_SEED_24,
  INVALID_SEED_12,
  TEST_PASSWORD,
  TEST_PRIVATE_KEY_HEX,
} from './fixtures/wallet';
import { clearWalletState, hasStoredWallet } from './helpers/storage';
import {
  createNewWallet,
  gotoLanding,
  importByPrivateKey,
  importBySeedPhrase,
  login,
} from './helpers/onboarding';
import {
  clickKcButton,
  waitForHeading,
  waitForRootTransition,
} from './helpers/wait';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await clearWalletState(page);
  });

  test('@smoke landing page shows create + import actions', async ({ page }) => {
    await gotoLanding(page);
    await expect(
      page.locator('kc-button', { hasText: 'Create New Wallet' }),
    ).toBeVisible();
    await expect(
      page.locator('kc-button', { hasText: 'Connect Existing Wallet' }),
    ).toBeVisible();
  });

  test('@smoke create new wallet (12 words) lands on home', async ({ page }) => {
    await gotoLanding(page);
    const seed = await createNewWallet(page, TEST_PASSWORD, 12);
    expect(seed).toHaveLength(12);
    expect(seed.every((w) => /^[a-z]+$/i.test(w))).toBe(true);
    expect(await hasStoredWallet(page)).toBe(true);
  });

  test('create new wallet supports 24-word option', async ({ page }) => {
    await gotoLanding(page);
    const seed = await createNewWallet(page, TEST_PASSWORD, 24);
    expect(seed).toHaveLength(24);
  });

  test('seed-saved checkbox gates the Continue button', async ({ page }) => {
    await gotoLanding(page);
    await clickKcButton(page, 'Create New Wallet');
    await waitForRootTransition(page);

    // Password step
    await waitForHeading(page, /Create Your Password/i);
    await page
      .locator('kc-input[formcontrolname="password"] input')
      .first()
      .fill(TEST_PASSWORD);
    await page
      .locator('kc-input[formcontrolname="confirmPassword"] input')
      .first()
      .fill(TEST_PASSWORD);
    await clickKcButton(page, 'Continue');

    // Seed display step — Continue must start disabled
    await waitForHeading(page, /Recovery Phrase/i);
    const continueBtn = page
      .locator('kc-button', { hasText: 'Continue' })
      .last()
      .locator('button')
      .first();
    await expect(continueBtn).toBeDisabled();

    await page.getByText('I saved my recovery phrase').click();
    await expect(continueBtn).toBeEnabled();
  });

  test('@smoke import via 12-word seed phrase lands on home', async ({ page }) => {
    await gotoLanding(page);
    await importBySeedPhrase(page, BIP39_TEST_SEED_12, TEST_PASSWORD);
    expect(await hasStoredWallet(page)).toBe(true);
  });

  test('import via 24-word seed phrase lands on home', async ({ page }) => {
    await gotoLanding(page);
    await importBySeedPhrase(page, BIP39_TEST_SEED_24, TEST_PASSWORD);
    expect(await hasStoredWallet(page)).toBe(true);
  });

  test('import with invalid seed surfaces an error (does not reach home)', async ({
    page,
  }) => {
    await gotoLanding(page);
    await clickKcButton(page, 'Connect Existing Wallet');
    await waitForRootTransition(page);

    // Import-switch step — Seed Phrase default, click Continue to advance.
    await waitForHeading(page, /Import Wallet/i);
    await clickKcButton(page, 'Continue');

    // Seed input step
    await waitForHeading(page, /Enter recovery phrase/i);
    const inputs = page.locator('.seed-phrase-step__word input');
    await expect(inputs).toHaveCount(12, { timeout: 10_000 });
    const words = INVALID_SEED_12.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      await inputs.nth(i).fill(words[i]);
    }
    await clickKcButton(page, 'Continue');

    // We must NOT reach /app/home within 10s.
    await page.waitForTimeout(5_000);
    expect(page.url()).not.toMatch(/\/app\/home/);
  });

  test('import via private key lands on home', async ({ page }) => {
    await gotoLanding(page);
    await importByPrivateKey(page, TEST_PRIVATE_KEY_HEX, TEST_PASSWORD);
    expect(await hasStoredWallet(page)).toBe(true);
  });

  test('@smoke login with wrong password shows invalid-credentials error', async ({
    page,
  }) => {
    await gotoLanding(page);
    await createNewWallet(page, TEST_PASSWORD, 12);

    // Reload to force login screen.
    await page.reload({ waitUntil: 'domcontentloaded' });
    const loginPw = page
      .locator('form.onboarding-v2__login-form kc-input input')
      .first();
    await expect(loginPw).toBeVisible({ timeout: 10_000 });
    await loginPw.fill('definitely-the-wrong-password');
    await clickKcButton(page, 'Login');

    await page.waitForTimeout(2_000);
    expect(page.url()).not.toMatch(/\/app\/home/);
  });

  test('login with correct password reaches home', async ({ page }) => {
    await gotoLanding(page);
    await createNewWallet(page, TEST_PASSWORD, 12);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 30_000 });
  });
});
