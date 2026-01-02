import { Component, signal, inject, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  KcIconComponent,
  KcTooltipDirective,
  KcSpinnerComponent,
} from 'kaspacom-ui';
import { FlowPageBaseComponent } from '../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../common/flow-page/interfaces/flow-page.interface';
import { QuickActionDialogService } from '../../../../../services/quick-action-dialog.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../classes/AppWallet';
import { ShortenAddressPipe } from '../../../../../../pipes/shorten-address.pipe';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  isSelected: boolean;
  wallet: AppWallet;
  balance: Signal<number | undefined>;
  isLoadingBalance: Signal<boolean>;
  hasPendingTransactions: Signal<boolean>;
  pendingTransactionCount: Signal<number>;
  isExpanded: boolean;
}

@Component({
  selector: 'app-wallet-management-page',
  standalone: true,
  imports: [
    CommonModule,
    KcIconComponent,
    KcTooltipDirective,
    KcSpinnerComponent,
    ShortenAddressPipe,
  ],
  templateUrl: './wallet-management-page.component.html',
  styleUrl: './wallet-management-page.component.scss',
})
export class WalletManagementPageComponent extends FlowPageBaseComponent {
  private quickActionDialogService = inject(QuickActionDialogService);
  private walletService = inject(WalletService);
  get config(): IFlowPageConfig {
    return {
      id: 'wallet-management',
      title: 'Manage accounts',
      canNavigateBack: false, // Explicitly disable back navigation
      canClose: false, // Disable default close button since we'll have custom one
      showTitle: false, // Hide the default header completely
    };
  }
  // Convert wallet accounts to our interface
  wallets = signal<WalletAccount[]>([]);

  // Get current wallet name for header
  currentWalletName = computed(() => {
    const wallet = this.walletService.getCurrentWallet();
    return wallet?.getName() || 'Wallet';
  });

  constructor() {
    super();
    this.loadWalletAccounts();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  public loadWalletAccounts(): void {
    // Get all wallets and current wallet - DON'T force balance refresh here
    const allWallets = this.walletService.getAllWallets(false)() || [];
    const currentWallet = this.walletService.getCurrentWallet();

    // If no current wallet, clear list
    if (!currentWallet) {
      this.wallets.set([]);
      return;
    }

    // Group wallets by ID to get accounts
    const walletGroups = new Map<number, AppWallet[]>();
    allWallets.forEach((wallet) => {
      const id = wallet.getId();
      if (!walletGroups.has(id)) {
        walletGroups.set(id, []);
      }
      walletGroups.get(id)!.push(wallet);
    });

    // Only use the group that matches the current wallet id
    const currentGroup = walletGroups.get(currentWallet.getId()) || [];

    // Convert to our interface format for the current wallet only
    const accounts: WalletAccount[] = [];
    if (currentGroup.length > 0 && currentGroup[0].supportAccounts()) {
      currentGroup.forEach((wallet) => {
        const address = this.getWalletAddress(wallet);
        const isLoadingBalance = signal(true);

        accounts.push({
          id: wallet.getIdWithAccount(),
          name: wallet.getAccountName() || wallet.getName(),
          address: address,
          isSelected:
            currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
          wallet: wallet,
          balance: computed(() => wallet.getTotalBalanceAsSignal()),
          isLoadingBalance: isLoadingBalance.asReadonly(),
          hasPendingTransactions: computed(() => {
            const mempoolData = wallet.getMempoolTransactionsSignalValue();
            return mempoolData
              ? mempoolData.sending.length > 0 ||
                  mempoolData.receiving.length > 0
              : false;
          }),
          pendingTransactionCount: computed(() => {
            const mempoolData = wallet.getMempoolTransactionsSignalValue();
            return mempoolData
              ? mempoolData.sending.length + mempoolData.receiving.length
              : 0;
          }),
          isExpanded: false,
        });

        // Load balance for this wallet asynchronously
        this.loadBalanceForWallet(wallet, isLoadingBalance);
      });
    } else if (currentGroup.length > 0) {
      // Single wallet without accounts
      const wallet = currentGroup[0];
      const address = this.getWalletAddress(wallet);
      const isLoadingBalance = signal(true);

      accounts.push({
        id: wallet.getIdWithAccount(),
        name: wallet.getName(),
        address: address,
        isSelected:
          currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
        wallet: wallet,
        balance: computed(() => wallet.getTotalBalanceAsSignal()),
        isLoadingBalance: isLoadingBalance.asReadonly(),
        hasPendingTransactions: computed(() => {
          const mempoolData = wallet.getMempoolTransactionsSignalValue();
          return mempoolData
            ? mempoolData.sending.length > 0 || mempoolData.receiving.length > 0
            : false;
        }),
        pendingTransactionCount: computed(() => {
          const mempoolData = wallet.getMempoolTransactionsSignalValue();
          return mempoolData
            ? mempoolData.sending.length + mempoolData.receiving.length
            : 0;
        }),
        isExpanded: false,
      });

      // Load balance for this wallet asynchronously
      this.loadBalanceForWallet(wallet, isLoadingBalance);
    }

    this.wallets.set(accounts);
  }

  private async loadBalanceForWallet(
    wallet: AppWallet,
    loadingSignal: any,
  ): Promise<void> {
    try {
      // Refresh the balance for this specific wallet
      await wallet.refreshUtxosBalance();
    } catch (error) {
      console.error(
        `Failed to load balance for wallet ${wallet.getAddress()}:`,
        error,
      );
    } finally {
      loadingSignal.set(false);
    }
  }

  async selectWallet(walletAccount: WalletAccount): Promise<void> {
    await this.walletService.selectCurrentWallet(
      walletAccount.wallet.getIdWithAccount(),
    );
    this.loadWalletAccounts(); // Reload to update selected state

    // Close the wallet management page after selection
    this.closeFlow();
  }

  editWalletAccount(walletAccount: WalletAccount): void {
    // Open the quick action dialog for editing account
    this.quickActionDialogService.openDialog({
      id: 'edit-account',
      title: 'Edit account',
      isCloseable: true,
      data: {
        accountName: walletAccount.name,
        wallet: walletAccount.wallet,
        isEditMode: true,
        // Pass callback to refresh accounts after successful operation
        onSuccess: async () => {
          // Give the wallet service time to update its internal state
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        },
      },
    });
  }

  exportWalletAccount(walletAccount: WalletAccount): void {
    this.navigateToNextPage({
      id: 'export-account',
      title: 'Export Private Key',
      canNavigateBack: true,
      canClose: false,
      showTitle: true,
      showBackground: true,
      data: {
        walletIdWithAccount: walletAccount.id,
      },
    });
  }

  deleteWallet(walletAccount: WalletAccount): void {
    // Open the delete confirmation dialog
    const isWalletWithoutAccounts = !walletAccount.wallet.supportAccounts();
    this.quickActionDialogService.openDialog({
      id: isWalletWithoutAccounts ? 'delete-wallet' : 'delete-account',
      title: isWalletWithoutAccounts ? 'Delete wallet' : 'Delete account',
      isCloseable: true,
      data: {
        ...(isWalletWithoutAccounts
          ? { walletName: walletAccount.name, wallet: walletAccount.wallet }
          : { accountName: walletAccount.name, wallet: walletAccount.wallet }),
        // Pass callback to refresh accounts after successful operation
        onSuccess: async () => {
          // Give the wallet service time to update its internal state
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        },
      },
    });
  }

  addWallet(): void {
    // Navigate to add wallet page
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true,
    });
  }

  createWallet(): void {
    // Navigate to create wallet page
    this.navigateToNextPage({
      id: 'create-wallet',
      title: 'Create Wallet',
      canNavigateBack: true,
    });
  }

  onAddAccountClick(): void {
    // Open the quick action dialog for add account
    this.quickActionDialogService.openDialog({
      id: 'add-account',
      title: 'Add account',
      isCloseable: true,
      data: {
        // Pass callback to refresh accounts after successful operation
        onSuccess: async () => {
          // Give the wallet service time to update its internal state
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        },
      },
    });
  }

  onCloseClick(): void {
    // Close the wallet management page
    this.closeFlow();
  }

  onEditWalletName(): void {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) return;

    // Open the quick action dialog for editing wallet name
    this.quickActionDialogService.openDialog({
      id: 'edit-wallet',
      title: 'Edit wallet name',
      isCloseable: true,
      data: {
        walletName: currentWallet.getName(),
        wallet: currentWallet,
        isEditMode: true,
        // Pass callback to refresh wallet name after successful operation
        onSuccess: async () => {
          // Give the wallet service time to update its internal state
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        },
      },
    });
  }

  onWalletOptionsClick(): void {
    // Open the wallet options dialog
    this.quickActionDialogService.openDialog({
      id: 'wallet-options',
      title: 'Wallet options',
      isCloseable: true,
      data: {},
    });
  }

  onChangeWalletClicked(): void {
    this.flowPagesService.navigateToPage({
      id: 'wallet-selection',
      title: 'Select wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  togglePendingTransactions(walletAccount: WalletAccount, event: Event): void {
    event.stopPropagation();
    const currentWallets = this.wallets();
    const updatedWallets = currentWallets.map((w) =>
      w.id === walletAccount.id ? { ...w, isExpanded: !w.isExpanded } : w,
    );
    this.wallets.set(updatedWallets);
  }

  private getWalletAddress(wallet: AppWallet): string {
    if (!this.walletService.isL2Display()) {
      return wallet.getAddress();
    } else {
      // For L2 networks, get the L2 address
      const l2State = wallet.getL2WalletStateSignal()();
      return l2State?.address || wallet.getAddress(); // fallback to L1
    }
  }
}
