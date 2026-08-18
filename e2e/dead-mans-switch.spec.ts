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

async function openContractDetails(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Details' }).first().click();
}

/**
 * Submit whatever curated action form is currently open (Claim, in this
 * spec) and dismiss the resulting approval/result screens, retrying once if
 * the network rejects the transaction for a stale locktime.
 *
 * The DMS covenant enforces `tx.time >= deadline` using the transaction's own
 * locktime field, which the SDK derives from an estimate that can lag behind
 * wall-clock time by tens of seconds. If the review screen sits open too
 * long before Approve, the built locktime can fall back under the deadline
 * and the node rejects it — a pre-existing quirk of any DMS claim (not
 * specific to partial claims). Retrying rebuilds the transaction with a
 * fresher locktime.
 */
async function submitActionWithLocktimeRetry(
  page: Page,
  reopenAction: () => Promise<void>,
): Promise<void> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Approve triggers transaction building (RPC round trips for UTXOs/fee
    // estimation) before it's clickable — under testnet RPC latency this has
    // been observed to exceed even a 30s action timeout.
    await page.getByRole('button', { name: 'Approve' }).click({
      timeout: 45_000,
    });

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
async function returnToContractDetails(page: Page): Promise<void> {
  const done = page.getByRole('button', { name: /^Done$/ });
  const gotDone = await done
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (gotDone) {
    await done.click();
    await openContractDetails(page);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await login(page, TEST_PASSWORD);
  await openContractsTab(page);
  await openContractDetails(page);
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
async function reopenClaimForm(page: Page): Promise<void> {
  await openContractDetails(page);
  await openClaimForm(page);
}

/**
 * Fill the claim amount field. Padded past the default 15s action timeout —
 * this input has been seen to take a moment to become fillable right after a
 * prior claim attempt's error/re-render settles.
 */
async function fillClaimAmount(page: Page, amountKas: string): Promise<void> {
  await page
    .getByRole('textbox', { name: '0' })
    .fill(amountKas, { timeout: 20_000 });
}

async function claimAmount(page: Page, amountKas: string): Promise<void> {
  // Called right after returnToContractDetails(), so the Details view is
  // already open — just open the Claim form directly.
  await openClaimForm(page);
  await fillClaimAmount(page, amountKas);
  await page.getByRole('button', { name: 'Claim', exact: true }).click();
  await submitActionWithLocktimeRetry(page, async () => {
    await reopenClaimForm(page);
    await fillClaimAmount(page, amountKas);
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
  });
  await returnToContractDetails(page);
}

test.describe("Dead Man's Switch — partial claim", () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('@funded deploy, sequential partial claims, invalid amounts, then full remainder', async ({
    page,
  }, testInfo) => {
    // Deploy + deadline wait + multiple on-chain claims comfortably exceeds
    // the default 60s Playwright timeout.
    test.setTimeout(14 * 60_000);

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
    await page.getByRole('button', { name: 'Approve' }).click({
      timeout: 30_000,
    });
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
    // poll the explorer independently of the UI. Truncated address displays
    // carry the full value in a `title` attribute; the contract address is
    // whichever one isn't this wallet's own address (owner === heir here).
    await openContractDetails(page);
    const addressTitles = page.locator('[title^="kaspatest:"]');
    let contractAddress: string | undefined;
    const titleCount = await addressTitles.count();
    for (let i = 0; i < titleCount; i++) {
      const title = await addressTitles.nth(i).getAttribute('title');
      if (title && title !== address) {
        contractAddress = title;
        break;
      }
    }

    // Wait for the deadline to pass with margin — the DMS covenant's
    // `tx.time >= deadline` check compares against the built transaction's
    // locktime, which lags wall-clock time (see submitActionWithLocktimeRetry).
    await page.waitForTimeout(70_000 + 30_000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page, TEST_PASSWORD);
    await openContractsTab(page);
    await openContractDetails(page);

    // ── Invalid amounts, rejected inline with no on-chain effect.
    await openClaimForm(page);
    for (const [bad, expectedMessage] of [
      ['0', 'Output amount must be greater than 0'],
      ['-1', 'Output amount must be greater than 0'],
      ['abc', 'Output amount must be greater than 0'],
      ['999', 'Withdraw amount cannot exceed the contract balance'],
    ] as const) {
      await fillClaimAmount(page, bad);
      await page.getByRole('button', { name: 'Claim', exact: true }).click();
      await expect(page.getByText(expectedMessage)).toBeVisible({
        timeout: 20_000,
      });
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
    await fillClaimAmount(page, '2');
    await page.getByRole('button', { name: 'Claim', exact: true }).click();
    await submitActionWithLocktimeRetry(page, async () => {
      await reopenClaimForm(page);
      await fillClaimAmount(page, '2');
      await page.getByRole('button', { name: 'Claim', exact: true }).click();
    });
    await returnToContractDetails(page);

    if (contractAddress) {
      await expect
        .poll(() => fetchUtxoAmountsKas(contractAddress), { timeout: 30_000 })
        .toEqual([4]);
    }
    testInfo.annotations.push({
      type: 'balance-after-partial-1-kas',
      description: (await fetchBalanceKas(address)).toString(),
    });

    await claimAmount(page, '1.5');

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
      await reopenClaimForm(page);
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
