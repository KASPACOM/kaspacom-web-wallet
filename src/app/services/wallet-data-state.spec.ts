import {
  assertUsableWalletData,
  partitionWalletData,
  WalletDataStateError,
} from './wallet-data-state';

describe('wallet data state', () => {
  it('rejects a record whose only wallet lost its account list', () => {
    expect(() =>
      assertUsableWalletData({
        id: 'wallet-data',
        version: '1',
        wallets: [{ id: 1, name: 'Wallet', mnemonic: 'encrypted', accounts: [] }],
      }),
    ).toThrowError(WalletDataStateError, 'wallet_account_missing');
  });

  it('does not lock the user out of healthy wallets over one broken record', () => {
    const userData = {
      id: 'wallet-data',
      version: '1',
      wallets: [
        { id: 1, name: 'Healthy', mnemonic: 'encrypted', accounts: [{}] },
        { id: 2, name: 'Legacy', privateKey: 'encrypted' },
        { id: 3, name: 'Broken', mnemonic: 'encrypted', accounts: [] },
      ],
    } as never;

    expect(() => assertUsableWalletData(userData)).not.toThrow();

    const { usable, unusable } = partitionWalletData(userData);
    expect(usable.map((wallet) => wallet.name)).toEqual(['Healthy', 'Legacy']);
    expect(unusable.map((wallet) => wallet.name)).toEqual(['Broken']);
  });

  it('keeps legacy private-key wallets without account metadata usable', () => {
    expect(() =>
      assertUsableWalletData({
        id: 'wallet-data',
        version: '1',
        wallets: [{ id: 1, name: 'Wallet', privateKey: 'encrypted' }],
      }),
    ).not.toThrow();
  });
});
