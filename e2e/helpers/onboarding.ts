import { Page, expect } from '@playwright/test';
import {
  clickKcButton,
  waitForHeading,
  waitForRootTransition,
  waitForWalletHome,
} from './wait';

export type WordCount = 12 | 24;

export async function gotoLanding(page: Page): Promise<void> {
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  // The desktop hero `<h1>` ("The Official KaspaCom Wallet") is hidden on
  // mobile viewports. Instead wait for the "Create New Wallet" button in
  // the phone-frame panel — visible in every viewport.
  await expect(
    page.locator('kc-button', { hasText: 'Create New Wallet' }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function fillPasswordInputs(
  page: Page,
  password: string,
  submitButtonText: 'Continue' | 'Next' = 'Continue',
): Promise<void> {
  const pw = page.locator('kc-input[formcontrolname="password"] input').first();
  const confirm = page
    .locator('kc-input[formcontrolname="confirmPassword"] input')
    .first();
  await expect(pw).toBeVisible({ timeout: 10_000 });
  await pw.fill(password);
  await confirm.fill(password);
  await clickKcButton(page, submitButtonText);
}

/**
 * Drive the "Create New Wallet" flow end-to-end.
 * Steps: CREATE_PASSWORD → CREATE_SEED_PHRASE → VERIFY_SEED_PHRASE →
 * SET_SEED_PASSPHRASE (skipped by leaving empty) → ADDRESS → SUCCESS.
 */
export async function createNewWallet(
  page: Page,
  password: string,
  wordCount: WordCount = 12,
): Promise<string[]> {
  await clickKcButton(page, 'Create New Wallet');
  await waitForRootTransition(page);

  // Step 1: Create password
  await waitForHeading(page, /Create Your Password/i);
  await fillPasswordInputs(page, password);

  // Step 2: Recovery phrase display
  await waitForHeading(page, /Recovery Phrase/i);
  if (wordCount === 24) {
    await page.getByText('24 words').click();
  }
  const wordEls = page.locator('app-seed-phrase-word');
  await expect(wordEls).toHaveCount(wordCount, { timeout: 10_000 });
  const seed: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const text = (await wordEls.nth(i).textContent())?.trim() ?? '';
    seed.push(text.replace(/^\d+\.?\s*/, '').trim());
  }
  await page.getByText('I saved my recovery phrase').click();
  await clickKcButton(page, 'Continue');

  // Step 3: Verify 3 random words
  await waitForHeading(page, /Verify Recovery Phrase/i);
  const verifyInputs = page.locator(
    'app-verify-seed-phrase-new-wallet-step kc-input input',
  );
  await expect(verifyInputs).toHaveCount(3, { timeout: 10_000 });
  for (let i = 0; i < 3; i++) {
    const placeholder =
      (await verifyInputs.nth(i).getAttribute('placeholder')) ?? '';
    const idxMatch = placeholder.match(/^(\d+)\.?/);
    if (!idxMatch) throw new Error(`Unexpected verify placeholder: ${placeholder}`);
    const idx = Number(idxMatch[1]) - 1;
    await verifyInputs.nth(i).fill(seed[idx]);
  }
  await clickKcButton(page, 'Continue');

  // Step 4: Optional seed passphrase — leave empty, click Continue
  await waitForHeading(page, /Seed Passphrase/i);
  await clickKcButton(page, 'Continue');

  // Step 5: Address — click Finish to trigger router.navigate(['/app/home'])
  await waitForHeading(page, /Wallet Created/i, 30_000);
  await clickKcButton(page, 'Finish');

  await waitForWalletHome(page);
  return seed;
}

export async function importBySeedPhrase(
  page: Page,
  seed: string,
  password: string,
): Promise<void> {
  await clickKcButton(page, 'Connect Existing Wallet');
  await waitForRootTransition(page);

  // Step 1: Import switch — Seed Phrase is the default method, so we just
  // need to click Continue to advance.
  await waitForHeading(page, /Import Wallet/i);
  await clickKcButton(page, 'Continue');

  // Step 2: Enter the seed phrase
  await waitForHeading(page, /Enter recovery phrase/i);
  const words = seed.trim().split(/\s+/);
  if (words.length === 24) {
    await page.getByText('24 words').click();
  }
  const inputs = page.locator('.seed-phrase-step__word input');
  await expect(inputs).toHaveCount(words.length, { timeout: 10_000 });
  for (let i = 0; i < words.length; i++) {
    await inputs.nth(i).fill(words[i]);
  }
  await clickKcButton(page, 'Continue');

  // Step 3: Optional passphrase — leave empty, Continue (may be absent).
  const passphraseHeading = page
    .locator('span.typo-title-3', { hasText: /Seed Passphrase/i })
    .first();
  const sawPassphraseStep = await passphraseHeading
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (sawPassphraseStep) {
    await clickKcButton(page, 'Continue');
  }

  // Step 4: Create PIN — import flow uses heading "Create Password" (no
  // "Your") and button "Next" (not "Continue"). Different component from
  // the new-wallet flow's CREATE_PASSWORD step.
  await waitForHeading(page, /^Create Password$/i);
  await fillPasswordInputs(page, password, 'Next');

  // Step 5: Success — "Wallet Loading" screen with a "Finish" button that
  // calls walletService.forceReloadWallets() then router.navigate(/app/home).
  // Unlike the new-wallet ADDRESS step, this one does not auto-navigate.
  await waitForHeading(page, /Wallet Loading/i);
  await clickKcButton(page, 'Finish');

  await waitForWalletHome(page);
}

export async function importByPrivateKey(
  page: Page,
  privateKey: string,
  password: string,
): Promise<void> {
  await clickKcButton(page, 'Connect Existing Wallet');
  await waitForRootTransition(page);

  await waitForHeading(page, /Import Wallet/i);
  await page.locator('.import-switch__option', { hasText: 'Private Key' }).click();
  await clickKcButton(page, 'Continue');

  await waitForHeading(page, /Enter private key/i);
  const input = page.locator('kc-input[formcontrolname="privateKey"] input').first();
  await input.fill(privateKey);
  await clickKcButton(page, 'Continue');

  await waitForHeading(page, /^Create Password$/i);
  await fillPasswordInputs(page, password, 'Next');

  await waitForHeading(page, /Wallet Loading/i);
  await clickKcButton(page, 'Finish');

  await waitForWalletHome(page);
}

export async function login(page: Page, password: string): Promise<void> {
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  const loginPw = page
    .locator('form.onboarding-v2__login-form kc-input input')
    .first();
  await expect(loginPw).toBeVisible({ timeout: 10_000 });
  await loginPw.fill(password);
  await clickKcButton(page, 'Login');
}
