import { test, expect } from '@playwright/test';
import { TEST_PASSWORD } from './fixtures/wallet';
import { clearWalletState } from './helpers/storage';
import { createNewWallet, gotoLanding } from './helpers/onboarding';
import { openWalletManagement } from './helpers/wallet-management';

test.describe('Multi-wallet management', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await clearWalletState(page);
    await gotoLanding(page);
    await createNewWallet(page, TEST_PASSWORD, 12);
  });

  test('@smoke opens wallet management and shows the active wallet marked selected', async ({
    page,
  }) => {
    await openWalletManagement(page);

    const items = page.locator('.wallet-item');
    await expect(items.first()).toBeVisible();

    // A freshly created wallet is the single item and should render the
    // `.selected` modifier (gradient border + icon-user).
    const selected = page.locator('.wallet-item.selected').first();
    await expect(selected).toBeVisible({ timeout: 5_000 });
    await expect(
      selected.locator('.wallet-item__name').first(),
    ).not.toHaveText('', { timeout: 5_000 });
  });

  // Row-action controls (export/delete icons) + add-account dialog tests
  // deferred to PR 4c.1. Initial CI run showed `.wallet-item__export` and
  // `.floating-orb → app-quick-action-dialog` don't render as the explore
  // agent's HTML snapshot suggested on a fresh wallet — needs a local
  // dev-server debug session to pin down the actual rendered state.
});
