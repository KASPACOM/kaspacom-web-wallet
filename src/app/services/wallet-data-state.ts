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

type SavedWallet = UserWalletsData['wallets'][number];

export interface PartitionedWalletData {
  usable: SavedWallet[];
  unusable: SavedWallet[];
}

/**
 * A mnemonic wallet with no accounts can't be derived from, but the other
 * wallets in the same record are untouched by that. Funds live behind those,
 * so they are separated out rather than blocking the whole set.
 */
export function partitionWalletData(
  userData: UserWalletsData,
): PartitionedWalletData {
  const usable: SavedWallet[] = [];
  const unusable: SavedWallet[] = [];

  for (const wallet of userData.wallets) {
    if (wallet.mnemonic && !wallet.accounts?.length) {
      unusable.push(wallet);
    } else {
      usable.push(wallet);
    }
  }

  return { usable, unusable };
}

/** Only a record with nothing left to load is unusable outright. */
export function assertUsableWalletData(userData: UserWalletsData): void {
  const { usable, unusable } = partitionWalletData(userData);

  if (unusable.length && !usable.length) {
    throw new WalletDataStateError('wallet_account_missing');
  }
}
