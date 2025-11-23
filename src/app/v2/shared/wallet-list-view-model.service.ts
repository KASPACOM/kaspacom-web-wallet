import { Injectable, inject } from '@angular/core';
import { WalletService } from '../../services/wallet.service';
import { AppWallet } from '../../classes/AppWallet';

export interface WalletGroupItem {
  id: number;
  name: string;
  address: string;
  isSelected: boolean;
  group: AppWallet[];
}

export interface WalletAccountItem {
  id: string;
  name: string;
  address: string;
  isSelected: boolean;
  wallet: AppWallet;
}

@Injectable({
  providedIn: 'root',
})
export class WalletListViewModelService {
  private walletService = inject(WalletService);

  /**
   * Loads all wallets and groups them by wallet ID
   * Returns an array of wallet group items with selection state
   */
  public loadWalletGroups(): WalletGroupItem[] {
    const allWallets = this.walletService.getAllWallets(true)() || [];
    const currentWallet = this.walletService.getCurrentWallet();

    const walletGroups = new Map<number, AppWallet[]>();
    allWallets.forEach((wallet) => {
      const id = wallet.getId();
      if (!walletGroups.has(id)) {
        walletGroups.set(id, []);
      }
      walletGroups.get(id)!.push(wallet);
    });

    const items: WalletGroupItem[] = [];
    walletGroups.forEach((group, id) => {
      const name = group[0].getName();
      const address = this.getWalletAddress(group[0]);
      const isSelected = currentWallet ? currentWallet.getId() === id : false;
      items.push({
        id,
        name,
        address,
        isSelected,
        group,
      });
    });

    return items;
  }

  /**
   * Builds account-level items for a given wallet group
   */
  public buildAccountItems(group: WalletGroupItem): WalletAccountItem[] {
    const currentWallet = this.walletService.getCurrentWallet();
    return group.group.map((wallet) => ({
      id: wallet.getIdWithAccount(),
      name: wallet.getAccountName() || wallet.getName(),
      address: this.getWalletAddress(wallet),
      isSelected:
        currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
      wallet,
    }));
  }

  /**
   * Gets the display address for a wallet, considering L2 state
   */
  public getWalletAddress(wallet: AppWallet): string {
    if (!this.walletService.isL2Display()) {
      return wallet.getAddress();
    } else {
      // For L2 networks, get the L2 address
      const l2State = wallet.getL2WalletStateSignal()();
      return l2State?.address || wallet.getAddress(); // fallback to L1
    }
  }

  /**
   * Shortens an address for display
   */
  public shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}

