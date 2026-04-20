import { test, expect } from '@playwright/test';
import { TEST_PASSWORD } from './fixtures/wallet';
import { clearWalletState } from './helpers/storage';
import { createNewWallet, gotoLanding } from './helpers/onboarding';
import { openSettings } from './helpers/settings';
import { clickKcButton } from './helpers/wait';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await clearWalletState(page);
    await gotoLanding(page);
    await createNewWallet(page, TEST_PASSWORD, 12);
  });

  test('@smoke opens settings menu with core items', async ({ page }) => {
    await openSettings(page);

    await expect(
      page.locator('.menu-item', { hasText: 'Export KaspaCom wallet' }),
    ).toBeVisible();
    await expect(
      page.locator('.menu-item.delete-wallet-item'),
    ).toBeVisible();
    await expect(page.locator('kc-button', { hasText: 'Log out' })).toBeVisible();
  });

  test('export wallet is password-gated and reveals backup data on verify', async ({
    page,
  }) => {
    await openSettings(page);

    await page
      .locator('.menu-item', { hasText: 'Export KaspaCom wallet' })
      .click();

    // Initial step: "Export wallet" kicks off the password step.
    await clickKcButton(page, 'Export wallet');

    const passwordInput = page.locator('#password-input').first();
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });

    // Wrong password should surface the error and stay on the password step.
    await passwordInput.fill('definitely-the-wrong-password');
    await clickKcButton(page, 'Verify Password');
    await expect(page.locator('.error-message').first()).toBeVisible({
      timeout: 5_000,
    });
    // The download button must NOT be visible while password is invalid.
    await expect(
      page.locator('kc-button', { hasText: 'Download Key File' }),
    ).not.toBeVisible();

    // Correct password → export step with download button.
    await passwordInput.fill('');
    await passwordInput.fill(TEST_PASSWORD);
    await clickKcButton(page, 'Verify Password');

    await expect(
      page.locator('kc-button', { hasText: 'Download Key File' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('delete wallet requires "DELETE MY DATA" phrase before the button enables', async ({
    page,
  }) => {
    await openSettings(page);

    await page.locator('.menu-item.delete-wallet-item').click();

    // Warning + confirmation input render on the same dialog.
    await expect(
      page.getByText(/Are you sure you want to delete/i),
    ).toBeVisible({ timeout: 10_000 });

    const phraseInput = page.locator('kc-input input').last();
    const deleteBtn = page
      .locator('kc-button', { hasText: 'Delete Wallet' })
      .locator('button')
      .first();
    await expect(deleteBtn).toBeDisabled();

    // Wrong phrase → still disabled.
    await phraseInput.fill('delete it now please');
    await expect(deleteBtn).toBeDisabled();

    // Correct phrase (case-insensitive per the component) → enabled.
    await phraseInput.fill('');
    await phraseInput.fill('DELETE MY DATA');
    await expect(deleteBtn).toBeEnabled();

    // We do NOT click through to the actual delete in this test — deletion
    // calls window.location.reload() which can destabilize the harness.
    // Behavior after click is covered separately.
  });
});
