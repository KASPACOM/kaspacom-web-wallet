import { Component, inject, signal, computed, Signal } from '@angular/core';

import { KcButtonComponent } from 'kaspacom-ui';
import { KcIconComponent, KcTooltipDirective, KcSpinnerComponent } from '@kaspacom/ui-kit';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { WalletService } from '../../../../../services/wallet.service';
import { QuickActionDialogService } from '../../../../services/quick-action-dialog.service';
import { AppWallet } from '../../../../../classes/AppWallet';
import { ShortenAddressPipe } from '../../../../../pipes/shorten-address.pipe';

interface WalletGroupItem {
  id: number;
  name: string;
  address: string;
  isSelected: boolean;
  group: AppWallet[];
  hasPendingTransactions: Signal<boolean>;
  pendingTransactionCount: Signal<number>;
  isExpanded: boolean;
}

@Component({
  selector: 'app-wallet-selection-page',
  standalone: true,
  imports: [
    KcButtonComponent,
    KcIconComponent,
    KcTooltipDirective,
    KcSpinnerComponent,
    ShortenAddressPipe,
  ],
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
      const address = this.getWalletAddress(group[0]);
      const isSelected = currentWallet ? currentWallet.getId() === id : false;

      // Check if any wallet in the group has pending transactions
      const hasPendingTransactions = computed(() => {
        return group.some((wallet) => {
          const mempoolData = wallet.getMempoolTransactionsSignalValue();
          return mempoolData
            ? mempoolData.sending.length > 0 || mempoolData.receiving.length > 0
            : false;
        });
      });

      const pendingTransactionCount = computed(() => {
        return group.reduce((total, wallet) => {
          const mempoolData = wallet.getMempoolTransactionsSignalValue();
          return mempoolData
            ? total + mempoolData.sending.length + mempoolData.receiving.length
            : total;
        }, 0);
      });

      items.push({
        id,
        name,
        address,
        isSelected,
        group,
        hasPendingTransactions,
        pendingTransactionCount,
        isExpanded: false,
      });
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
          // Wallet operations already update state, just refresh UI
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
          // Wallet operations already update state, just refresh UI
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

  togglePendingTransactions(item: WalletGroupItem, event: Event): void {
    event.stopPropagation();
    const currentWallets = this.wallets();
    const updatedWallets = currentWallets.map((w) =>
      w.id === item.id ? { ...w, isExpanded: !w.isExpanded } : w,
    );
    this.wallets.set(updatedWallets);
  }

  private getWalletAddress(wallet: AppWallet): string {
    return this.walletService.isL2Display()
      ? wallet.getL2WalletAddress()
      : wallet.getAddress();
  }
}
