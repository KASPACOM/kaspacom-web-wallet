import { Page, expect } from '@playwright/test';
import { clickKcButton, waitForStepTransition, waitForWalletHome } from './wait';

export type WordCount = 12 | 24;

export async function gotoLanding(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Official KaspaCom Wallet/i })).toBeVisible();
}

async function fillPasswordStep(page: Page, password: string): Promise<void> {
  const pw = page.locator('kc-input[formcontrolname="password"] input').first();
  const confirm = page
    .locator('kc-input[formcontrolname="confirmPassword"] input')
    .first();
  await expect(pw).toBeVisible();
  await pw.fill(password);
  await confirm.fill(password);
  await clickKcButton(page, 'Continue');
  await waitForStepTransition(page);
}

/**
 * Drive the "Create New Wallet" flow end-to-end.
 * Captures the generated seed at the display step, then re-enters the three
 * verification words, and asserts arrival at /app/home.
 */
export async function createNewWallet(
  page: Page,
  password: string,
  wordCount: WordCount = 12,
): Promise<string[]> {
  await clickKcButton(page, 'Create New Wallet');
  await waitForStepTransition(page);

  await fillPasswordStep(page, password);

  // Seed display
  if (wordCount === 24) {
    await page.getByText('24 words').click();
  }
  const wordEls = page.locator('app-seed-phrase-word');
  await expect(wordEls).toHaveCount(wordCount);
  const seed: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const text = (await wordEls.nth(i).textContent())?.trim() ?? '';
    // strip leading index like "1. " or "1"
    const word = text.replace(/^\d+\.?\s*/, '').trim();
    seed.push(word);
  }

  await page.getByText('I saved my recovery phrase').click();
  await clickKcButton(page, 'Continue');
  await waitForStepTransition(page);

  // Verify step: 3 random words. Each input's placeholder is "<idx>."
  const verifyInputs = page.locator('app-verify-seed-phrase-new-wallet-step kc-input input');
  await expect(verifyInputs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const placeholder = (await verifyInputs.nth(i).getAttribute('placeholder')) ?? '';
    const idxMatch = placeholder.match(/^(\d+)\.?/);
    if (!idxMatch) throw new Error(`Unexpected verify placeholder: ${placeholder}`);
    const idx = Number(idxMatch[1]) - 1;
    await verifyInputs.nth(i).fill(seed[idx]);
  }
  await clickKcButton(page, 'Continue');
  await waitForStepTransition(page);

  await waitForWalletHome(page);
  return seed;
}

export async function importBySeedPhrase(
  page: Page,
  seed: string,
  password: string,
): Promise<void> {
  await clickKcButton(page, 'Connect Existing Wallet');
  await waitForStepTransition(page);

  // Default method = Seed Phrase on the switch, just click Continue / enter words.
  await page
    .locator('.import-switch__option', { hasText: 'Seed Phrase' })
    .click({ trial: false })
    .catch(() => {
      /* already selected */
    });

  const words = seed.trim().split(/\s+/);
  if (words.length === 24) {
    await page.getByText('24 words').click();
  }

  const inputs = page.locator('.seed-phrase-step__word input');
  await expect(inputs).toHaveCount(words.length);
  for (let i = 0; i < words.length; i++) {
    await inputs.nth(i).fill(words[i]);
  }
  await clickKcButton(page, 'Continue');
  await waitForStepTransition(page);

  await fillPasswordStep(page, password);
  await waitForWalletHome(page);
}

export async function importByPrivateKey(
  page: Page,
  privateKey: string,
  password: string,
): Promise<void> {
  await clickKcButton(page, 'Connect Existing Wallet');
  await waitForStepTransition(page);

  await page.locator('.import-switch__option', { hasText: 'Private Key' }).click();

  const input = page.locator('kc-input[formcontrolname="privateKey"] input').first();
  await expect(input).toBeVisible();
  await input.fill(privateKey);
  await clickKcButton(page, 'Continue');
  await waitForStepTransition(page);

  await fillPasswordStep(page, password);
  await waitForWalletHome(page);
}

export async function login(page: Page, password: string): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loginPw = page.locator('form.onboarding-v2__login-form kc-input input').first();
  await expect(loginPw).toBeVisible();
  await loginPw.fill(password);
  await clickKcButton(page, 'Login');
}
