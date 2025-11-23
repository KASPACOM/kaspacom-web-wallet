import { Component, inject, signal, EventEmitter, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { WalletService } from '../../../../services/wallet.service';
import {
  WalletListViewModelService,
  WalletGroupItem,
  WalletAccountItem,
} from '../../../shared/wallet-list-view-model.service';

@Component({
  selector: 'app-iframe-account-selection',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './iframe-account-selection.component.html',
  styleUrl: './iframe-account-selection.component.scss',
})
export class IframeAccountSelectionComponent {
  private walletService = inject(WalletService);
  private walletListViewModel = inject(WalletListViewModelService);
  private router = inject(Router);

  @Output() accountSelected = new EventEmitter<void>();

  walletGroups = signal<WalletGroupItem[]>([]);
  selectedWalletGroup = signal<WalletGroupItem | undefined>(undefined);
  isLoggingOut = signal(false);
  hasMultipleWallets = computed(() => this.walletGroups().length > 1);
  isWalletSelectionVisible = computed(
    () => this.hasMultipleWallets() && !this.selectedWalletGroup(),
  );
  selectedWalletName = computed(
    () => this.selectedWalletGroup()?.name || '',
  );
  accountItems = computed<WalletAccountItem[]>(() => {
    const group = this.selectedWalletGroup();
    if (!group) {
      return [];
    }
    return this.walletListViewModel.buildAccountItems(group);
  });

  constructor() {
    this.loadWallets();
  }

  public loadWallets(): void {
    const items = this.walletListViewModel.loadWalletGroups();
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
    await this.walletService.selectCurrentWallet(account.wallet.getIdWithAccount());
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

  shortenAddress(address: string): string {
    return this.walletListViewModel.shortenAddress(address);
  }
}

