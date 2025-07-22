import { Component, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { FlowPageBaseComponent } from '../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../common/flow-page/interfaces/flow-page.interface';
import { QuickActionDialogService, IQuickActionDialogConfig } from '../../../common/services/quick-action-dialog.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../classes/AppWallet';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  isSelected: boolean;
  wallet: AppWallet;
}

@Component({
  selector: 'app-wallet-management-page',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './wallet-management-page.component.html',
  styleUrl: './wallet-management-page.component.scss'
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
      showTitle: false // Hide the default header completely
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
    // Get all wallets and current wallet - force fresh data by calling the signal
    const allWallets = this.walletService.getAllWallets(true)() || [];
    const currentWallet = this.walletService.getCurrentWallet();

    // Group wallets by ID to get accounts
    const walletGroups = new Map<number, AppWallet[]>();
    allWallets.forEach(wallet => {
      const id = wallet.getId();
      if (!walletGroups.has(id)) {
        walletGroups.set(id, []);
      }
      walletGroups.get(id)!.push(wallet);
    });

    // Convert to our interface format
    const accounts: WalletAccount[] = [];
    walletGroups.forEach(walletGroup => {
      // Only process wallets that have accounts
      if (walletGroup.length > 0 && walletGroup[0].supportAccounts()) {
        walletGroup.forEach(wallet => {
          accounts.push({
            id: wallet.getIdWithAccount(),
            name: wallet.getAccountName() || wallet.getName(),
            address: wallet.getAddress(),
            balance: wallet.getTotalBalanceAsSignal() || 0,
            isSelected: currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
            wallet: wallet
          });
        });
      } else if (walletGroup.length > 0) {
        // Single wallet without accounts
        const wallet = walletGroup[0];
        accounts.push({
          id: wallet.getIdWithAccount(),
          name: wallet.getName(),
          address: wallet.getAddress(),
          balance: wallet.getTotalBalanceAsSignal() || 0,
          isSelected: currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
          wallet: wallet
        });
      }
    });

    this.wallets.set(accounts);
  }

  async selectWallet(walletAccount: WalletAccount): Promise<void> {
    await this.walletService.selectCurrentWallet(walletAccount.wallet.getIdWithAccount());
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
          await new Promise(resolve => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        }
      }
    });
  }

  deleteWallet(walletAccount: WalletAccount): void {
    // Open the delete confirmation dialog
    this.quickActionDialogService.openDialog({
      id: 'delete-account',
      title: 'Delete account',
      isCloseable: true,
      data: {
        accountName: walletAccount.name,
        wallet: walletAccount.wallet,
        // Pass callback to refresh accounts after successful operation
        onSuccess: async () => {
          // Give the wallet service time to update its internal state
          await new Promise(resolve => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        }
      }
    });
  }

  addWallet(): void {
    // Navigate to add wallet page
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true
    });
  }

  createWallet(): void {
    // Navigate to create wallet page
    this.navigateToNextPage({
      id: 'create-wallet',
      title: 'Create Wallet',
      canNavigateBack: true
    });
  }

  manageWallets(): void {
    // Navigate to manage wallets functionality
    // You can implement the specific functionality here
    console.log('Manage wallets clicked');
    // For now, could navigate to add wallet page as an example
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true
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
          await new Promise(resolve => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        }
      }
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
          await new Promise(resolve => setTimeout(resolve, 100));
          this.loadWalletAccounts();
        }
      }
    });
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}
