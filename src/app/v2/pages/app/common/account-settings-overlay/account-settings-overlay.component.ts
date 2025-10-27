import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { WalletService } from '../../../../../services/wallet.service';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../../../../../classes/AppWallet';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  balanceDisplay: string;
  isSelected: boolean;
  wallet: AppWallet;
}

@Component({
  selector: 'app-account-settings-overlay',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
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
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);


  // Real wallet data
  wallets = signal<WalletAccount[]>([]);

  ngOnInit(): void {
    this.loadWallets();
  }

  private loadWallets(): void {
    // Get all wallets and current wallet
    const allWallets = this.walletService.getAllWallets(true)() || [];
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
          const network = this.networkSelectionService.getCurrentNetwork();
          const address = this.getWalletAddress(wallet, network);
          const balance = this.getWalletBalance(wallet, network);

          accounts.push({
            id: wallet.getIdWithAccount(),
            name: wallet.getAccountName() || wallet.getName(),
            address: address,
            balance: balance,
            balanceDisplay: `${balance} ${network === 'l1-kaspa' ? 'KAS' : 'KAS'}`,
            isSelected:
              currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
            wallet: wallet,
          });
        });
      } else if (group.length > 0) {
        // Single wallet without accounts
        const wallet = group[0];
        const network = this.networkSelectionService.getCurrentNetwork();
        const address = this.getWalletAddress(wallet, network);
        const balance = this.getWalletBalance(wallet, network);

        accounts.push({
          id: wallet.getIdWithAccount(),
          name: wallet.getName(),
          address: address,
          balance: balance,
          balanceDisplay: `${balance} ${network === 'l1-kaspa' ? 'KAS' : 'KAS'}`,
          isSelected:
            currentWallet?.getIdWithAccount() === wallet.getIdWithAccount(),
          wallet: wallet,
        });
      }
    });

    this.wallets.set(accounts);
  }

  private getWalletAddress(wallet: AppWallet, network: string): string {
    if (network === 'l1-kaspa') {
      return wallet.getAddress();
    } else {
      // For L2 networks, get the L2 address
      const l2State = wallet.getL2WalletStateSignal()();
      return l2State?.address || wallet.getAddress(); // fallback to L1
    }
  }

  private getWalletBalance(wallet: AppWallet, network: string): number {
    if (network === 'l1-kaspa') {
      const balanceData = wallet.getCurrentWalletStateBalanceSignalValue();
      return balanceData
        ? this.kaspaNetworkActionsService.sompiToNumber(balanceData.mature)
        : 0;
    } else {
      // For L2 networks, get the L2 balance
      const l2State = wallet.getL2WalletStateSignal()();
      return l2State ? l2State.balanceFormatted : 0;
    }
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

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}
