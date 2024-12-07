import { SavedWalletData } from './saved-wallet-data';

export interface UserWalletsData {
  wallets: SavedWalletData[];
  version: string;
  id: string;
}
