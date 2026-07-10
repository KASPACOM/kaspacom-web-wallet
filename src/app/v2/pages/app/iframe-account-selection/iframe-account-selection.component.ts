import { Component, inject, signal, computed, output } from '@angular/core';

import { Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../services/wallet.service';
import { AppWallet } from '../../../../classes/AppWallet';
import { ShortenAddressPipe } from '../../../../pipes/shorten-address.pipe';

interface WalletGroupItem {
  id: number;
  name: string;
  address: string;
  isSelected: boolean;
  group: AppWallet[];
}

interface WalletAccountItem {
  id: string;
  name: string;
  address: string;
  isSelected: boolean;
  wallet: AppWallet;
}

@Component({
  selector: 'app-iframe-account-selection',
  standalone: true,
  imports: [KcButtonComponent, KcIconComponent, ShortenAddressPipe],
  templateUrl: './iframe-account-selection.component.html',
  styleUrl: './iframe-account-selection.component.scss',
})
export class IframeAccountSelectionComponent {
  private walletService = inject(WalletService);
  private router = inject(Router);

  readonly accountSelected = output<void>();

  walletGroups = signal<WalletGroupItem[]>([]);
  selectedWalletGroup = signal<WalletGroupItem | undefined>(undefined);
  isLoggingOut = signal(false);
  hasMultipleWallets = computed(() => this.walletGroups().length > 1);
  isWalletSelectionVisible = computed(
    () => this.hasMultipleWallets() && !this.selectedWalletGroup(),
  );
  selectedWalletName = computed(() => this.selectedWalletGroup()?.name || '');
  accountItems = computed<WalletAccountItem[]>(() => {
    const group = this.selectedWalletGroup();
    if (!group) {
      return [];
    }
    const currentWallet = this.walletService.getCurrentWallet();
    return group.group.map((wallet) => ({
      id: wallet.getIdWithAccount(),
      name: wallet.getAccountName() || wallet.getName(),
      address: this.getWalletAddress(wallet),
      isSelected:
        currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
      wallet,
    }));
  });

  constructor() {
    this.loadWallets();
  }

  public loadWallets(): void {
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

    this.walletGroups.set(items);

    if (items.length === 1) {
      this.selectedWalletGroup.set(items[0]);
    } else if (items.length > 1) {
      this.selectedWalletGroup.set(undefined);
    } else {
      this.selectedWalletGroup.set(undefined);
    }
  }

  selectWalletGroup(item: WalletGroupItem): void {
    this.selectedWalletGroup.set(item);
  }

  onChangeWallet(): void {
    if (this.hasMultipleWallets()) {
      this.selectedWalletGroup.set(undefined);
    }
  }

  async selectAccount(account: WalletAccountItem): Promise<void> {
    await this.walletService.selectCurrentWallet(
      account.wallet.getIdWithAccount(),
    );
    this.accountSelected.emit();
  }

  async onLogout(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);

    try {
      await this.walletService.logout();
      await this.router.navigate(['/onboarding']);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still try to navigate even if there's an error
      await this.router.navigate(['/onboarding']);
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  private getWalletAddress(wallet: AppWallet): string {
    return this.walletService.isL2Display()
      ? wallet.getL2WalletAddress()
      : wallet.getAddress();
  }
}
