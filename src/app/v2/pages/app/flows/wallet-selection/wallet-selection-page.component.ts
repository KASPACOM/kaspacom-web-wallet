import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent, KcTooltipDirective } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { WalletService } from '../../../../../services/wallet.service';
import { QuickActionDialogService } from '../../../../services/quick-action-dialog.service';
import { WalletListViewModelService, WalletGroupItem } from '../../../../shared/wallet-list-view-model.service';

@Component({
  selector: 'app-wallet-selection-page',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent, KcTooltipDirective],
  templateUrl: './wallet-selection-page.component.html',
  styleUrl: './wallet-selection-page.component.scss',
})
export class WalletSelectionPageComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private quickActionDialogService = inject(QuickActionDialogService);
  private walletListViewModel = inject(WalletListViewModelService);

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
    const items = this.walletListViewModel.loadWalletGroups();
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

  shortenAddress(address: string): string {
    return this.walletListViewModel.shortenAddress(address);
  }
}
