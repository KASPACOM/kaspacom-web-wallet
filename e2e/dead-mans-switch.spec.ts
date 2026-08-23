import { test, expect, Page } from '@playwright/test';
import { authenticateFundedWallet } from './helpers/auth';
import { readWalletAddress } from './helpers/home';
import { login } from './helpers/onboarding';
import { TN10 } from './fixtures/network';

const SOMPI_PER_KAS = 100_000_000;
const TEST_PASSWORD = 'WalletE2E!Password1';

async function fetchBalanceKas(address: string): Promise<number> {
  const res = await fetch(
    `${TN10.kaspaApiBaseurl}/addresses/${encodeURIComponent(address)}/balance`,
  );
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const body = (await res.json()) as { balance?: number | string };
  const sompi =
    typeof body.balance === 'string'
      ? Number(body.balance)
      : (body.balance ?? 0);
  return sompi / SOMPI_PER_KAS;
}

async function fetchUtxoAmountsKas(address: string): Promise<number[]> {
  const res = await fetch(
    `${TN10.kaspaApiBaseurl}/addresses/${encodeURIComponent(address)}/utxos`,
  );
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const body = (await res.json()) as Array<{ utxoEntry: { amount: string } }>;
  return body.map((u) => Number(u.utxoEntry.amount) / SOMPI_PER_KAS);
}

/** datetime-local value in the machine's local timezone, `msFromNow` in the future. */
function localDateTimeValue(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The cookie-consent banner is injected by a script that can finish loading
 * several seconds into the test, well after any one-time dismissal click
 * would run, and an injected stylesheet doesn't reliably hide it (likely
 * CSP-blocked) — so instead, watch for it and remove it outright as soon as
 * it appears, on every navigation.
 */
async function suppressCookieBanner(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const removeBanner = () => {
      document.getElementById('kaspa-consent-banner')?.remove();
    };
    // `documentElement` may not exist yet this early in the navigation, and
    // a MutationObserver can't attach to a null target — poll as a fallback
    // in addition to observing once the tree exists.
    removeBanner();
    const intervalId = setInterval(removeBanner, 250);
    setTimeout(() => clearInterval(intervalId), 60_000);
    document.addEventListener('DOMContentLoaded', () => {
      removeBanner();
      new MutationObserver(removeBanner).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  });
}

async function openContractsTab(page: Page): Promise<void> {
  await page
    .locator('div', { hasText: /^Contracts$/ })
    .first()
    .click();
}

/**
 * Open the "Details" view for a specific contract card, not just whichever
 * one currently sorts first in "My Contracts". This wallet accumulates many
 * Dead Man's Switch deployments across repeated local test runs (same
 * owner/heir address every time), and card ordering isn't a reliable way to
 * keep re-targeting *this* run's contract — a stale card winning `.first()`
 * surfaces as "Covenant outpoint ... was not found" much later, on whatever
 * unrelated, already-fully-spent contract got clicked into.
 *
 * Each value in `matchValues` is checked against the card's id/address
 * `title` attribute or its latest-action link `href`. Multiple candidates
 * matter because the card's id row switches from showing the contract
 * address to its covenant ID once the indexer catches up — passing both
 * keeps matching working across that switch. Falls back to `.first()` only
 * for the very first open right after a fresh deploy, before any
 * identifying value is known yet.
 */
async function openContractDetails(
  page: Page,
  matchValues?: string[],
): Promise<void> {
  const values = (matchValues || []).filter(Boolean);
  const card = values.length
    ? page
        .locator('.contract-card')
        .filter({
          has: page.locator(
            values
              .map((v) => `[title="${v}"], a[href*="${v}"]`)
              .join(', '),
          ),
        })
        .first()
    : page.locator('.contract-card').first();
  await card.getByRole('button', { name: 'Details' }).click();
}

/**
 * Submit whatever curated action form is currently open (Claim, in this
 * spec) and dismiss the resulting approval/result screens, retrying if the
 * network rejects the transaction for a stale locktime.
 *
 * The DMS covenant enforces `tx.time >= deadline` using the transaction's own
 * locktime field, which the SDK derives from an estimate that can lag behind
 * wall-clock time by tens of seconds. If the review screen sits open too
 * long before Approve, the built locktime can fall back under the deadline
 * and the node rejects it — a pre-existing quirk of any DMS claim (not
 * specific to partial claims). Retrying rebuilds the transaction with a
 * fresher locktime; the gap narrows by roughly the retry wait each attempt,
 * so more attempts are needed for TN10's slower confirmation pace than for
 * the first claim of a run — observed missing by under a second on the 6th
 * attempt in one local run, so this leaves real headroom above that.
 */
async function submitActionWithLocktimeRetry(
  page: Page,
  reopenAction: () => Promise<void>,
): Promise<void> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // The app retries a not-yet-visible covenant outpoint for up to ~28s
    // before the review screen (and this button) even renders — comfortably
    // past the global 15s action timeout, so this click needs its own
    // headroom rather than timing out on a submission that's still working.
    await page
      .getByRole('button', { name: 'Approve' })
      .click({ timeout: 35_000 });

    const failed = page.getByText('Transaction Failed');
    const succeeded = page.getByText('Transaction Successful!');
    await expect(failed.or(succeeded)).toBeVisible({ timeout: 20_000 });

    if (await succeeded.isVisible().catch(() => false)) return;

    const errorText = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    const isLocktimeStale = errorText.includes('Unsatisfied lock time');
    if (!isLocktimeStale || attempt === maxAttempts) {
      throw new Error(
        `Transaction failed (attempt ${attempt}, locktimeStale=${isLocktimeStale}): ${errorText.slice(-600)}`,
      );
    }

    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(20_000);
    await reopenAction();
  }
}

/**
 * Return to the "My Contracts" detail view after a submitted action. The
 * success screen's "Done"/continue button stays disabled until the indexer
 * catches up, which can take longer than is worth blocking the test on —
 * reloading (and logging back in) gets back to a consistent state either way
 * since the registry update itself is applied optimistically, not indexer-
 * gated.
 */
async function returnToContractDetails(
  page: Page,
  contractIdentifiers: string[],
): Promise<void> {
  const done = page.getByRole('button', { name: /^Done$/ });
  const gotDone = await done
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (gotDone) {
    await done.click();
    await openContractDetails(page, contractIdentifiers);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await login(page, TEST_PASSWORD);
  await openContractsTab(page);
  await openContractDetails(page, contractIdentifiers);
}

async function openClaimForm(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: ' Claim Claim the inheritance' })
    .click();
}

/**
 * A failed/closed attempt drops back to the "My Contracts" list, not the
 * claim form — reopening means going through Details -> Claim again.
 */
async function reopenClaimForm(
  page: Page,
  contractIdentifiers: string[],
): Promise<void> {
  await openContractDetails(page, contractIdentifiers);
  await openClaimForm(page);
}

async function claimAmount(
  page: Page,
  amountKas: string,
  contractIdentifiers: string[],
): Promise<void> {
  // Called right after returnToContractDetails(), so the Details view is
  // already open — just open the Claim form directly.
  await openClaimForm(page);
  await page.getByRole('textbox', { name: '0' }).fill(amountKas);
  await page.getByRole('button', { name: 'Claim', exact: true }).click();
  await submitActionWithLocktimeRetry(page, async () => {
    await reopenClaimForm(page, contractIdentifiers);
    await page.getByRole('textbox', { name: '0' }).fill(amountKas);
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
  });
  await returnToContractDetails(page, contractIdentifiers);
}

test.describe("Dead Man's Switch — partial claim", () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('@funded deploy, sequential partial claims, invalid amounts, then full remainder', async ({
    page,
  }, testInfo) => {
    // Deploy + deadline wait + multiple on-chain claims (each with up to 10
    // locktime-retry attempts) comfortably exceeds the default 60s Playwright
    // timeout.
    test.setTimeout(20 * 60_000);

    await suppressCookieBanner(page);
    await authenticateFundedWallet(page);
    const address = await readWalletAddress(page);
    testInfo.annotations.push({
      type: 'owner-heir-address',
      description: address,
    });

    const balanceBeforeDeploy = await fetchBalanceKas(address);
    testInfo.annotations.push({
      type: 'balance-before-deploy-kas',
      description: balanceBeforeDeploy.toString(),
    });

    // ── Deploy a Dead Man's Switch: owner = heir = this wallet (single-seed
    // test), deadline ~70s out so the heir becomes eligible to claim shortly.
    await openContractsTab(page);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: /Dead Man's Switch/ }).click();

    await page.getByRole('textbox', { name: 'Heir wallet' }).fill(address);
    const deadlineValue = localDateTimeValue(70_000);
    await page.locator('input[type="datetime-local"]').fill(deadlineValue);
    const deployAmountKas = 6;
    await page
      .getByRole('textbox', { name: '0.5' })
      .fill(String(deployAmountKas));

    await page
      .getByRole('button', { name: 'Review and deploy covenant' })
      .click();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Transaction Successful!')).toBeVisible({
      timeout: 30_000,
    });
    const deployTxid = await page
      .locator('div', { hasText: /^Transaction ID$/ })
      .last()
      .locator('xpath=following-sibling::*[1]')
      .textContent()
      .catch(() => null);
    testInfo.annotations.push({
      type: 'deploy-txid',
      description: deployTxid?.trim() || '(not captured)',
    });
    await page.getByRole('button', { name: 'Done' }).click();

    // Find the contract's covenant address from the detail panel so we can
    // poll the explorer independently of the UI, and so every later reopen
    // can target this exact contract instead of whichever one sorts first.
    // Matching by deployTxid here (not `.first()`) is what makes this
    // reliable in a wallet that accumulates many DMS contracts across
    // repeated local test runs. Read the "Contract address" identifier
    // directly by its label rather than scraping any `[title^="kaspatest:"]`
    // element on the page — with owner === heir, both the Owner and Heir
    // participant rows now carry this wallet's own address as their title
    // too, so a generic scrape can no longer assume the first non-own-wallet
    // title it finds is the contract's.
    const deployTxidTrimmed = deployTxid?.trim() || undefined;
    await openContractDetails(
      page,
      deployTxidTrimmed ? [deployTxidTrimmed] : undefined,
    );
    const contractAddressValue = page
      .locator('.identifier', { hasText: 'Contract address' })
      .locator('.identifier-value');
    await contractAddressValue.waitFor({ state: 'visible', timeout: 15_000 });
    const contractAddress = await contractAddressValue.getAttribute('title');
    if (!contractAddress) {
      throw new Error(
        "Could not determine this run's contract address from the detail panel.",
      );
    }
    // Once the indexer catches up, the dashboard card's id row switches from
    // showing this address to showing the covenant ID instead — capture both
    // (when available) so every later reopen keeps matching regardless of
    // which one the card currently shows.
    const covenantId = await page
      .locator('.identifier', { hasText: 'Covenant ID' })
      .locator('.identifier-value')
      .getAttribute('title')
      .catch(() => null);
    const contractIdentifiers = [contractAddress, covenantId].filter(
      (value): value is string => !!value,
    );

    // Wait for the deadline to pass with margin — the DMS covenant's
    // `tx.time >= deadline` check compares against the built transaction's
    // locktime, which lags wall-clock time (see submitActionWithLocktimeRetry).
    await page.waitForTimeout(70_000 + 30_000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page, TEST_PASSWORD);
    await openContractsTab(page);
    await openContractDetails(page, contractIdentifiers);

    // ── Invalid amounts, rejected inline with no on-chain effect.
    await openClaimForm(page);
    for (const [bad, expectedMessage] of [
      ['0', 'Output amount must be greater than 0'],
      ['-1', 'Output amount must be greater than 0'],
      ['abc', 'Output amount must be greater than 0'],
      ['999', 'Withdraw amount cannot exceed the contract balance'],
    ] as const) {
      await page.getByRole('textbox', { name: '0' }).fill(bad);
      await page.getByRole('button', { name: 'Claim', exact: true }).click();
      await expect(page.getByText(expectedMessage)).toBeVisible();
    }
    // No transaction was submitted by any of the rejected amounts above —
    // balance only reflects the deploy spend (amount + its own small fee).
    const balanceDuringValidation = await fetchBalanceKas(address);
    expect(balanceDuringValidation).toBeGreaterThan(
      balanceBeforeDeploy - deployAmountKas - 0.02,
    );
    expect(balanceDuringValidation).toBeLessThan(
      balanceBeforeDeploy - deployAmountKas + 0.001,
    );

    // ── Sequential partial claims: 2 KAS, then 1.5 KAS.
    await page.getByRole('textbox', { name: '0' }).fill('2');
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
    await submitActionWithLocktimeRetry(page, async () => {
      await reopenClaimForm(page, contractIdentifiers);
      await page.getByRole('textbox', { name: '0' }).fill('2');
      await page.getByRole('button', { name: 'Claim', exact: true }).click();
    });
    await returnToContractDetails(page, contractIdentifiers);

    if (contractAddress) {
      await expect
        .poll(() => fetchUtxoAmountsKas(contractAddress), { timeout: 30_000 })
        .toEqual([4]);
    }
    testInfo.annotations.push({
      type: 'balance-after-partial-1-kas',
      description: (await fetchBalanceKas(address)).toString(),
    });

    await claimAmount(page, '1.5', contractIdentifiers);

    if (contractAddress) {
      await expect
        .poll(() => fetchUtxoAmountsKas(contractAddress), { timeout: 30_000 })
        .toEqual([2.5]);
    }
    testInfo.annotations.push({
      type: 'balance-after-partial-2-kas',
      description: (await fetchBalanceKas(address)).toString(),
    });

    // ── Full remainder claim — single output, contract fully spent.
    await openClaimForm(page);
    await page.locator('.max-text.clickable').first().click();
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
    await submitActionWithLocktimeRetry(page, async () => {
      await reopenClaimForm(page, contractIdentifiers);
      await page.locator('.max-text.clickable').first().click();
      await page.getByRole('button', { name: 'Claim', exact: true }).click();
    });

    if (contractAddress) {
      await expect
        .poll(() => fetchUtxoAmountsKas(contractAddress), { timeout: 30_000 })
        .toEqual([]);
    }
    // Owner === heir here, so the deployed amount round-trips back to the
    // same wallet across the 3 claims minus only the handful of tx fees
    // (deploy + 3 claims, a few thousandths of a KAS each) — allow a
    // generous 0.1 KAS margin. The balance endpoint can lag a UTXO-level
    // view briefly right after broadcast, so poll rather than read once.
    await expect
      .poll(() => fetchBalanceKas(address), { timeout: 30_000 })
      .toBeGreaterThan(balanceBeforeDeploy - 0.1);
    const finalBalance = await fetchBalanceKas(address);
    testInfo.annotations.push({
      type: 'balance-after-full-remainder-kas',
      description: finalBalance.toString(),
    });
  });
});
