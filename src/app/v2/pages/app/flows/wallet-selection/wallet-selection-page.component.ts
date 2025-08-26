import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { WalletService } from '../../../../../services/wallet.service';
import { AppWallet } from '../../../../../classes/AppWallet';
import { QuickActionDialogService } from '../../../../services/quick-action-dialog.service';

interface WalletGroupItem {
  id: number;
  name: string;
  address: string;
  balance: number;
  isSelected: boolean;
  group: AppWallet[];
}

@Component({
  selector: 'app-wallet-selection-page',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './wallet-selection-page.component.html',
  styleUrl: './wallet-selection-page.component.scss',
})
export class WalletSelectionPageComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private quickActionDialogService = inject(QuickActionDialogService);

  get config(): IFlowPageConfig {
    return {
      id: 'wallet-selection',
      title: 'Select wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    };
  }

  wallets = signal<WalletGroupItem[]>([]);

  constructor() {
    super();
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
      const address = group[0].getAddress();
      const balance = group.reduce(
        (sum, w) => sum + (w.getTotalBalanceAsSignal() || 0),
        0,
      );
      const isSelected = currentWallet ? currentWallet.getId() === id : false;
      items.push({ id, name, address, balance, isSelected, group });
    });

    this.wallets.set(items);
  }

  async selectWallet(item: WalletGroupItem): Promise<void> {
    const target = item.group[0];
    await this.walletService.selectCurrentWallet(target.getIdWithAccount());
    this.closeFlow();
  }

  editWallet(item: WalletGroupItem): void {
    const target = item.group[0];
    this.quickActionDialogService.openDialog({
      id: 'edit-wallet',
      title: 'Edit wallet name',
      isCloseable: true,
      data: {
        walletName: target.getName(),
        wallet: target,
        isEditMode: true,
        onSuccess: async () => {
          await new Promise((r) => setTimeout(r, 100));
          this.loadWallets();
        },
      },
    });
  }

  deleteWallet(item: WalletGroupItem): void {
    const target = item.group[0];
    this.quickActionDialogService.openDialog({
      id: 'delete-wallet',
      title: 'Delete wallet',
      isCloseable: true,
      data: {
        walletName: target.getName(),
        wallet: target,
        onSuccess: async () => {
          await new Promise((r) => setTimeout(r, 100));
          this.loadWallets();
        },
      },
    });
  }

  addWallet(): void {
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true,
    });
  }

  createWallet(): void {
    this.navigateToNextPage({
      id: 'create-wallet',
      title: 'Create Wallet',
      canNavigateBack: true,
    });
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}
