import {
  assertUsableWalletData,
  WalletDataStateError,
} from './wallet-data-state';

describe('wallet data state', () => {
  it('rejects mnemonic wallets whose account list was lost', () => {
    expect(() =>
      assertUsableWalletData({
        id: 'wallet-data',
        version: '1',
        wallets: [{ id: 1, name: 'Wallet', mnemonic: 'encrypted', accounts: [] }],
      }),
    ).toThrowError(WalletDataStateError, 'wallet_account_missing');
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
