import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnInit,
  Signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent, KcTooltipDirective } from '@kaspacom/ui-kit';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { WalletService } from '../../../../../services/wallet.service';
import { AppWallet } from '../../../../../classes/AppWallet';
import { ShortenAddressPipe } from '../../../../../pipes/shorten-address.pipe';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  isSelected: boolean;
  wallet: AppWallet;
  balance: Signal<number | undefined>;
  isLoadingBalance: Signal<boolean>;
}

@Component({
  selector: 'app-account-settings-overlay',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent, KcTooltipDirective, ShortenAddressPipe],
  templateUrl: './account-settings-overlay.component.html',
  styleUrl: './account-settings-overlay.component.scss',
  animations: [
    trigger('slideDown', [
      state(
        'closed',
        style({
          transform: 'translateY(-100%)',
          opacity: 0,
          visibility: 'hidden',
        }),
      ),
      state(
        'open',
        style({
          transform: 'translateY(0)',
          opacity: 1,
          visibility: 'visible',
        }),
      ),
      transition('closed => open', [
        style({
          visibility: 'visible',
          transform: 'translateY(-100%)',
          opacity: 0,
        }),
        animate(
          '300ms ease-out',
          style({
            transform: 'translateY(0)',
            opacity: 1,
          }),
        ),
      ]),
      transition('open => closed', [
        animate(
          '200ms ease-in',
          style({
            transform: 'translateY(-100%)',
            opacity: 0,
          }),
        ),
        style({ visibility: 'hidden' }),
      ]),
    ]),
  ],
})
export class AccountSettingsOverlayComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  private walletService = inject(WalletService);
  // Real wallet data
  wallets = signal<WalletAccount[]>([]);

  ngOnInit(): void {
    this.loadWallets();
  }

  private loadWallets(): void {
    // Get all wallets and current wallet - DON'T force balance refresh here
    const allWallets = this.walletService.getAllWallets(false)() || [];
    const currentWallet = this.walletService.getCurrentWallet();

    // Group wallets by ID to get accounts
    const walletGroups = new Map<number, AppWallet[]>();
    allWallets.forEach((wallet) => {
      const id = wallet.getId();
      if (!walletGroups.has(id)) {
        walletGroups.set(id, []);
      }
      walletGroups.get(id)!.push(wallet);
    });

    // Convert to our interface format
    const accounts: WalletAccount[] = [];
    walletGroups.forEach((group) => {
      if (group.length > 0 && group[0].supportAccounts()) {
        group.forEach((wallet) => {
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
          });

          // Load balance for this wallet asynchronously
          this.loadBalanceForWallet(wallet, isLoadingBalance);
        });
      } else if (group.length > 0) {
        // Single wallet without accounts
        const wallet = group[0];
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
        });

        // Load balance for this wallet asynchronously
        this.loadBalanceForWallet(wallet, isLoadingBalance);
      }
    });

    this.wallets.set(accounts);
  }

  private async loadBalanceForWallet(wallet: AppWallet, loadingSignal: any): Promise<void> {
    try {
      // Refresh the balance for this specific wallet
      await wallet.refreshUtxosBalance();
    } catch (error) {
      console.error(`Failed to load balance for wallet ${wallet.getAddress()}:`, error);
    } finally {
      loadingSignal.set(false);
    }
  }

  private getWalletAddress(wallet: AppWallet): string {
    return this.walletService.isL2Display() ? wallet.getL2WalletAddress() : wallet.getAddress();
  }

  onClose(): void {
    this.close.emit();
  }

  async selectWallet(wallet: WalletAccount): Promise<void> {
    // Update the selected state
    this.wallets.update((wallets) =>
      wallets.map((w) => ({
        ...w,
        isSelected: w.id === wallet.id,
      })),
    );

    // Switch to the selected wallet
    await this.walletService.selectCurrentWallet(wallet.id);
  }

  deleteWallet(wallet: WalletAccount): void {
    // Logic for deleting wallet would go here
    console.log('Delete wallet:', wallet.name);
  }

  addWallet(): void {
    // Logic for adding wallet
    console.log('Add wallet clicked');
  }

  createWallet(): void {
    // Logic for creating wallet
    console.log('Create wallet clicked');
  }
}
