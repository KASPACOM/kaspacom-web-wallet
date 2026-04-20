import { test, expect } from '@playwright/test';
import { authenticateFundedWallet } from './helpers/auth';
import { readKasBalance, readWalletAddress } from './helpers/home';

test.describe('Funded wallet', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('@funded imports pre-funded seed and shows balance + address', async ({
    page,
  }, testInfo) => {
    await authenticateFundedWallet(page);

    const [balance, address] = await Promise.all([
      readKasBalance(page),
      readWalletAddress(page),
    ]);

    // Surface the derived address in the report so whoever needs to top up
    // the faucet wallet can find it without re-running locally.
    testInfo.annotations.push({ type: 'wallet-address', description: address });
    testInfo.annotations.push({
      type: 'kas-balance',
      description: balance.toString(),
    });

    expect(address).toMatch(/^kaspatest:[a-z0-9]+$/);
    expect(balance).not.toBeNaN();

    test.skip(
      balance <= 0,
      `Wallet ${address} is empty on TN10 — fund via https://faucet.kaspanet.io/ before enabling send tests`,
    );
    expect(balance).toBeGreaterThan(0);
  });
});
