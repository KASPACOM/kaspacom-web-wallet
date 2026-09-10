import { UserWalletsData } from '../types/user-wallets-data';

export type WalletDataStateErrorCode =
  | 'password_missing'
  | 'user_data_missing'
  | 'wallet_account_missing';

export class WalletDataStateError extends Error {
  constructor(readonly code: WalletDataStateErrorCode) {
    super(code);
    this.name = 'WalletDataStateError';
  }
}

export function assertUsableWalletData(userData: UserWalletsData): void {
  const hasInvalidMnemonicWallet = userData.wallets.some(
    (wallet) => wallet.mnemonic && !wallet.accounts?.length,
  );
  if (hasInvalidMnemonicWallet) {
    throw new WalletDataStateError('wallet_account_missing');
  }
}
