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

  test('@smoke wallet item exposes address + export + delete controls in the DOM', async ({
    page,
  }) => {
    await openWalletManagement(page);

    // .wallet-item__export and __trash are styled `opacity:0; visibility:hidden`
    // on desktop and only become visible on row hover (SCSS line 207) or
    // under `@media (max-width:768px)`. For a regression test we only care
    // that they are attached to the DOM — a dropped icon would still fail
    // `.toBeAttached()`. This keeps us viewport- and hover-agnostic.
    const firstItem = page.locator('.wallet-item').first();
    await expect(firstItem.locator('.wallet-item__address').first()).toBeVisible();
    await expect(firstItem.locator('.wallet-item__export').first()).toBeAttached();
    await expect(firstItem.locator('.wallet-item__trash').first()).toBeAttached();
  });

  test('@smoke add-account dialog opens from the floating orb and validates input', async ({
    page,
  }) => {
    await openWalletManagement(page);

    const orb = page.locator('.floating-orb').first();
    const orbVisible = await orb.isVisible().catch(() => false);
    test.skip(
      !orbVisible,
      'floating-orb (add account) not available for this wallet scheme.',
    );

    await orb.click();

    // The `app-quick-action-dialog` host element is display:inline with
    // height:0 (Angular portal pattern). The real dialog box is rendered
    // as the `.quick-action-dialog-content` child with the slideUp
    // animation — that's what we can assert on.
    await expect(page.locator('.quick-action-dialog-content').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Add account/i).first()).toBeVisible();

    // The add-account dialog's CTA is labeled "Create" (not "Save" as
    // the explore report guessed).
    const createBtn = page
      .locator('.quick-action-dialog-content kc-button', { hasText: 'Create' })
      .locator('button')
      .first();
    await expect(createBtn).toBeDisabled();

    const nameInput = page
      .locator('.quick-action-dialog-content kc-input input')
      .first();
    await nameInput.fill('E2E test account');
    await expect(createBtn).toBeEnabled();
  });
});
