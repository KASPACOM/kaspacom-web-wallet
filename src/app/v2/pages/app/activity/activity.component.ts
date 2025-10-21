import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  OnDestroy,
  effect,
} from '@angular/core';
import { BaseActivityComponent } from './base-activity.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KcIconComponent } from '@kaspacom/ui';
import {
  KcLabeledTabsComponent,
  TabItem,
} from '../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { WalletService } from '../../../../services/wallet.service';
import { KaspaApiService } from '../../../../services/kaspa-api/kaspa-api.service';
import { KasplexKrc20Service } from '../../../../services/kasplex-api/kasplex-api.service';
import { FullTransactionResponseItem } from '../../../../services/kaspa-api/dtos/full-transaction-response.dto';
import { OperationDetails } from '../../../../services/kasplex-api/dtos/operation-details-response';
import {
  Erc20TransactionService,
  ERC20Transaction,
} from '../../../../services/etherium-services/erc20-transaction.service';
import { KaspaNetworkActionsService } from '../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { firstValueFrom, catchError, of, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

// Types for activity items
interface BaseActivityItem {
  id: string;
  type: 'kaspa' | 'krc20' | 'erc20';
  timestamp: number;
  status: 'accepted' | 'pending' | 'rejected';
}

interface KaspaActivityItem extends BaseActivityItem {
  type: 'kaspa';
  amount: bigint;
  isIncoming: boolean;
  fee: bigint;
  fromAddress?: string;
  toAddress?: string;
}

interface Krc20ActivityItem extends BaseActivityItem {
  type: 'krc20';
  operation: string;
  ticker: string;
  amount: string;
  fromAddress?: string;
  toAddress?: string;
}

export interface Erc20ActivityItem extends BaseActivityItem {
  type: 'erc20';
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  amount: string;
  isIncoming: boolean;
  fromAddress?: string;
  toAddress?: string;
  gasUsed?: string;
  gasPrice?: string;
}

type ActivityItem = KaspaActivityItem | Krc20ActivityItem | Erc20ActivityItem;

@Component({
  selector: 'app-activity',
  imports: [
    CommonModule,
    KcIconComponent,
    KcLabeledTabsComponent,
    SkeletonComponent,
  ],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent
  extends BaseActivityComponent<ActivityItem>
  implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  private kaspaApiService = inject(KaspaApiService);
  private kasplexService = inject(KasplexKrc20Service);
  private erc20TransactionService = inject(Erc20TransactionService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // Signals for reactive state
  private kaspaTransactions = signal<FullTransactionResponseItem[]>([]);
  private krc20Operations = signal<OperationDetails[]>([]);
  private erc20Transactions = signal<ERC20Transaction[]>([]);
  private combinedActivityItems = signal<ActivityItem[]>([]);
  private isLoadingKaspa = signal<boolean>(true);
  private isLoadingKrc20 = signal<boolean>(true);
  private isLoadingErc20 = signal<boolean>(true);

  // Computed combined activity list
  allActivity = computed<ActivityItem[]>(() => {
    return this.combinedActivityItems();
  });

  // Async computed for combined activity (L1: Kaspa + KRC20)
  private async getCombinedActivity(): Promise<ActivityItem[]> {
    const kaspaItems = await Promise.all(
      this.kaspaTransactions().map((tx) => this.transformKaspaTransaction(tx)),
    );
    const krc20Items = await Promise.all(
      this.krc20Operations().map((op) => this.transformKrc20Operation(op)),
    );
    const erc20Items = this.erc20Transactions().map((tx) =>
      this.transformErc20Transaction(tx),
    );

    // Combine and sort by timestamp (newest first)
    return [...kaspaItems, ...krc20Items, ...erc20Items].sort((a, b) => {
      const timestampA =
        typeof a.timestamp === 'number'
          ? a.timestamp
          : parseInt(String(a.timestamp));
      const timestampB =
        typeof b.timestamp === 'number'
          ? b.timestamp
          : parseInt(String(b.timestamp));
      return timestampB - timestampA;
    });
  }

  // TODO: Implement proper L2 activity fetching
  private async getCombinedActivityForL2(): Promise<ActivityItem[]> {
    const erc20Items = this.erc20Transactions().map((tx) =>
      this.transformErc20Transaction(tx),
    );

    // Sort by timestamp (newest first)
    return erc20Items.sort((a, b) => {
      const timestampA =
        typeof a.timestamp === 'number'
          ? a.timestamp
          : parseInt(String(a.timestamp));
      const timestampB =
        typeof b.timestamp === 'number'
          ? b.timestamp
          : parseInt(String(b.timestamp));
      return timestampB - timestampA;
    });
  }

  // Filtered activity based on selected tab
  override filteredActivity = computed<ActivityItem[]>(() => {
    const selectedTab = this.selectedTabId();
    const allItems = this.allActivity();

    switch (selectedTab) {
      case 'kaspa':
        return allItems.filter((item) => item.type === 'kaspa');
      case 'erc20':
        return allItems.filter((item) => item.type === 'erc20');
      default:
        return allItems;
    }
  });

  // Loading state
  isLoading = computed(
    () =>
      this.isLoadingKaspa() || this.isLoadingKrc20() || this.isLoadingErc20(),
  );

  // Reactive tabs configuration based on current network
  tabs = computed<TabItem[]>(() => {
    const isL2Network = this.walletService.isL2Display();

    if (isL2Network) {
      return [
        { id: 'all', label: 'All Activity' },
        { id: 'erc20', label: 'ERC20' },
      ];
    } else {
      return [
        { id: 'all', label: 'All Activity' },
        { id: 'kaspa', label: 'Kaspa' },
        { id: 'krc20', label: 'KRC20' },
      ];
    }
  });

  constructor() {
    super();

    toObservable(this.walletService.getIsL2DisplaySignal()).subscribe(() => {
      this.resetActivityData();
      this.loadActivityData();
    });
  }

  ngOnInit() {
    // Initial load is handled by the effect in constructor
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTransactionClick(item: ActivityItem): void {
    if (item.type === 'kaspa') {
      // Navigate to Kaspa transaction details with transaction data
      const transactionData = this.kaspaTransactions().find(
        (tx) => tx.transaction_id === item.id,
      );

      if (transactionData) {
        this.router.navigate(['/app/home/transaction/kaspa', item.id], {
          state: { transactionData },
        });
      }
    } else if (item.type === 'krc20') {
      // Navigate to KRC20 transaction details with return context
      const krc20Item = item as Krc20ActivityItem;
      this.router.navigate(
        ['/app/home/asset/krc20', krc20Item.ticker, 'transaction', item.id],
        {
          state: { returnTo: 'activity' },
        },
      );
    } else if (item.type === 'erc20') {
      // TODO: Create ERC20 transaction details page
      const erc20Item = item as Erc20ActivityItem;
      console.log('ERC20 transaction clicked:', erc20Item);
    }
  }

  private resetActivityData() {
    this.kaspaTransactions.set([]);
    this.krc20Operations.set([]);
    this.erc20Transactions.set([]);
    this.combinedActivityItems.set([]);
    this.isLoadingKaspa.set(true);
    this.isLoadingKrc20.set(true);
    this.isLoadingErc20.set(true);

    const currentTab = this.selectedTabId();
    const availableTabs = this.tabs().map((tab) => tab.id);

    if (!availableTabs.includes(currentTab)) {
      this.selectedTabId.set('all');
    }
  }

  private async loadActivityData() {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      console.warn('No current wallet selected');
      this.isLoadingKaspa.set(false);
      this.isLoadingKrc20.set(false);
      this.isLoadingErc20.set(false);
      return;
    }

    const isL2Network = this.walletService.isL2Display();

    if (isL2Network) {
      // TODO: L2 transaction history needs implementation
      const l2WalletAddress = await currentWallet.getL2WalletAddress();
      if (l2WalletAddress) {
        await this.loadErc20Transactions(l2WalletAddress);
      }
      this.isLoadingKaspa.set(false);
      this.isLoadingKrc20.set(false);

      const combinedItems = await this.getCombinedActivityForL2();
      this.combinedActivityItems.set(combinedItems);
    } else {
      const walletAddress = currentWallet.getAddress();

      await Promise.all([
        this.loadKaspaTransactions(walletAddress),
        this.loadKrc20Operations(walletAddress),
      ]);
      this.isLoadingErc20.set(false);

      const combinedItems = await this.getCombinedActivity();
      this.combinedActivityItems.set(combinedItems);
    }
  }

  private async loadKaspaTransactions(walletAddress: string) {
    try {
      this.isLoadingKaspa.set(true);

      const transactions = await firstValueFrom(
        this.kaspaApiService
          .getFullTransactions(walletAddress, 'light', 20)
          .pipe(
            catchError((err: any) => {
              console.error('Error fetching Kaspa transactions:', err);
              return of([] as FullTransactionResponseItem[]);
            }),
            takeUntil(this.destroy$),
          ),
      );

      this.kaspaTransactions.set(transactions || []);
    } catch (error) {
      console.error('Failed to load Kaspa transactions:', error);
      this.kaspaTransactions.set([]);
    } finally {
      this.isLoadingKaspa.set(false);
    }
  }

  private async loadKrc20Operations(walletAddress: string) {
    try {
      this.isLoadingKrc20.set(true);

      const operationsResponse = await firstValueFrom(
        this.kasplexService.getWalletOperationHistory(walletAddress).pipe(
          catchError((err: any) => {
            console.error('Error fetching KRC20 operations:', err);
            return of({
              message: 'error',
              prev: '',
              next: '',
              result: [] as OperationDetails[],
            });
          }),
          takeUntil(this.destroy$),
        ),
      );

      if (
        operationsResponse.message === 'successful' &&
        operationsResponse.result
      ) {
        this.krc20Operations.set(operationsResponse.result);
      } else {
        this.krc20Operations.set([]);
      }
    } catch (error) {
      console.error('Failed to load KRC20 operations:', error);
      this.krc20Operations.set([]);
    } finally {
      this.isLoadingKrc20.set(false);
    }
  }

  private async loadErc20Transactions(walletAddress: string) {
    try {
      this.isLoadingErc20.set(true);

      const erc20Transactions =
        await this.erc20TransactionService.getERC20TransactionHistory(
          walletAddress,
          50,
        );

      this.erc20Transactions.set(erc20Transactions || []);
    } catch (error) {
      console.error('Failed to load ERC20 transactions:', error);
      this.erc20Transactions.set([]);
    } finally {
      this.isLoadingErc20.set(false);
    }
  }

  private async transformKaspaTransaction(
    transaction: FullTransactionResponseItem,
  ): Promise<KaspaActivityItem> {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      throw new Error('No current wallet');
    }

    const isL2Network = this.walletService.isL2Display();
    const walletAddress = isL2Network
      ? (await currentWallet.getL2WalletAddress()) || currentWallet.getAddress()
      : currentWallet.getAddress();

    // Calculate input and output amounts for this wallet
    const senders = transaction.inputs.reduce(
      (acc: Record<string, bigint>, input: any) => {
        const address = input.previous_outpoint_address;
        if (!acc[address]) {
          acc[address] = BigInt(0);
        }
        acc[address] += BigInt(input.previous_outpoint_amount || 0);
        return acc;
      },
      {} as Record<string, bigint>,
    );

    const receivers = transaction.outputs.reduce(
      (acc: Record<string, bigint>, output: any) => {
        const address = output.script_public_key_address;
        if (!acc[address]) {
          acc[address] = BigInt(0);
        }
        acc[address] += BigInt(output.amount);
        return acc;
      },
      {} as Record<string, bigint>,
    );

    const totalForThisWallet =
      (receivers[walletAddress] || BigInt(0)) -
      (senders[walletAddress] || BigInt(0));
    const isIncoming = totalForThisWallet > 0;

    // Calculate fee
    const fee =
      Object.values(senders).reduce(
        (acc: bigint, val: bigint) => acc + val,
        0n,
      ) -
      Object.values(receivers).reduce(
        (acc: bigint, val: bigint) => acc + val,
        0n,
      );

    // Find the other address (from or to)
    let otherAddress = '';
    if (isIncoming) {
      // Find sender address (excluding our wallet)
      otherAddress =
        Object.keys(senders).find((addr) => addr !== walletAddress) || '';
    } else {
      // Find receiver address (excluding our wallet)
      otherAddress =
        Object.keys(receivers).find((addr) => addr !== walletAddress) || '';
    }

    return {
      id: transaction.transaction_id,
      type: 'kaspa',
      timestamp: transaction.block_time, // Already in milliseconds
      status: transaction.is_accepted ? 'accepted' : 'pending',
      amount:
        totalForThisWallet < 0n ? -totalForThisWallet : totalForThisWallet,
      isIncoming,
      fee,
      fromAddress: isIncoming ? otherAddress : walletAddress,
      toAddress: isIncoming ? walletAddress : otherAddress,
    };
  }

  private async transformKrc20Operation(
    operation: OperationDetails,
  ): Promise<Krc20ActivityItem> {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      throw new Error('No current wallet');
    }

    const walletAddress = this.walletService.isL2Display()
      ? (await currentWallet.getL2WalletAddress()) || currentWallet.getAddress()
      : currentWallet.getAddress();

    let status: 'accepted' | 'pending' | 'rejected' = 'pending';
    if (operation.opAccept === '1' && operation.txAccept === '1') {
      status = 'accepted';
    } else if (operation.opAccept === '-1') {
      status = 'rejected';
    }

    return {
      id: operation.hashRev,
      type: 'krc20',
      timestamp: parseInt(operation.mtsAdd),
      status,
      operation: operation.op,
      ticker: operation.tick,
      amount: operation.amt || '0',
      fromAddress: operation.from,
      toAddress: operation.to,
    };
  }

  private transformErc20Transaction(
    transaction: ERC20Transaction,
  ): Erc20ActivityItem {
    const currentWallet = this.walletService.getCurrentWallet();
    const walletAddress = currentWallet?.getAddress() || '';

    // Determine if this transaction is incoming or outgoing for the current wallet
    const isIncoming =
      transaction.to.toLowerCase() === walletAddress.toLowerCase();

    return {
      id: transaction.hash,
      type: 'erc20',
      timestamp: transaction.timestamp,
      status: transaction.status,
      tokenAddress: transaction.tokenAddress,
      tokenSymbol: transaction.tokenSymbol,
      tokenName: transaction.tokenName,
      amount: transaction.value,
      isIncoming,
      fromAddress: transaction.from,
      toAddress: transaction.to,
      gasUsed: transaction.gasUsed,
      gasPrice: transaction.gasPrice,
    };
  }

  // Template helper methods
  formatTimestamp(timestamp: number): string {
    const timeAgo = new TimeAgoPipe().transform(timestamp);
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });

    return `${timeAgo} • ${formattedDate}`;
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  getOperationTitle(
    operation: string,
    fromAddress?: string,
    toAddress?: string,
  ): string {
    const currentWallet = this.walletService.getCurrentWallet();
    const walletAddress = currentWallet?.getAddress() || '';

    let title = operation.charAt(0).toUpperCase() + operation.slice(1);

    if (operation === 'transfer' || operation === 'send') {
      if (fromAddress === walletAddress && toAddress === walletAddress) {
        title = 'Cancel List';
      } else if (toAddress === walletAddress) {
        title = 'Received';
      } else if (fromAddress === walletAddress) {
        title = 'Sent';
      }
    }

    return title;
  }

  getActivityIcon(item: ActivityItem): string {
    if (item.type === 'kaspa') {
      return (item as KaspaActivityItem).isIncoming
        ? 'icon-arrow-down'
        : 'icon-arrow-up';
    } else if (item.type === 'erc20') {
      return (item as Erc20ActivityItem).isIncoming
        ? 'icon-arrow-down'
        : 'icon-arrow-up';
    } else {
      const operation = (item as Krc20ActivityItem).operation;
      switch (operation) {
        case 'deploy':
          return 'icon-deploy';
        case 'mint':
          return 'icon-mint';
        case 'transfer':
        case 'send':
          return 'icon-arrow-up';
        case 'list':
          return 'icon-list';
        default:
          return 'icon-tokens';
      }
    }
  }

  getActivityIconColor(item: ActivityItem): string {
    if (item.type === 'kaspa') {
      return (item as KaspaActivityItem).isIncoming
        ? 'var(--green-20)'
        : 'var(--red-20)';
    } else if (item.type === 'erc20') {
      return (item as Erc20ActivityItem).isIncoming
        ? 'var(--green-20)'
        : 'var(--red-20)';
    } else {
      return 'var(--purple-20)';
    }
  }

  // Helper methods for template
  getKaspaActivityTitle(item: ActivityItem): string {
    const kaspaItem = item as KaspaActivityItem;
    return kaspaItem.isIncoming ? 'Received Kaspa' : 'Sent Kaspa';
  }

  getKaspaActivitySubtitle(item: ActivityItem): string {
    const kaspaItem = item as KaspaActivityItem;
    const direction = kaspaItem.isIncoming ? 'From' : 'To';
    const address = kaspaItem.isIncoming
      ? kaspaItem.fromAddress
      : kaspaItem.toAddress;
    return `${direction}: ${this.shortenAddress(address || '')}`;
  }

  getKrc20ActivityTitle(item: ActivityItem): string {
    const krc20Item = item as Krc20ActivityItem;
    const title = this.getOperationTitle(
      krc20Item.operation,
      krc20Item.fromAddress,
      krc20Item.toAddress,
    );
    return `${title} ${krc20Item.ticker.toUpperCase()}`;
  }

  getKrc20ActivitySubtitle(item: ActivityItem): string {
    const krc20Item = item as Krc20ActivityItem;
    const direction =
      krc20Item.operation === 'send' || krc20Item.operation === 'transfer'
        ? 'To'
        : 'From';
    const address = krc20Item.toAddress || krc20Item.fromAddress;
    return `${direction}: ${this.shortenAddress(address || '')}`;
  }

  getErc20ActivityTitle(item: ActivityItem): string {
    const erc20Item = item as Erc20ActivityItem;
    const action = erc20Item.isIncoming ? 'Received' : 'Sent';
    const tokenSymbol = erc20Item.tokenSymbol || 'TOKEN';
    return `${action} ${tokenSymbol.toUpperCase()}`;
  }

  getErc20ActivitySubtitle(item: ActivityItem): string {
    const erc20Item = item as Erc20ActivityItem;
    const direction = erc20Item.isIncoming ? 'From' : 'To';
    const address = erc20Item.isIncoming
      ? erc20Item.fromAddress
      : erc20Item.toAddress;
    return `${direction}: ${this.shortenAddress(address || '')}`;
  }

  hasKrc20Address(item: ActivityItem): boolean {
    const krc20Item = item as Krc20ActivityItem;
    return !!(krc20Item.fromAddress && krc20Item.toAddress);
  }

  getKaspaAmountDisplay(item: ActivityItem): string {
    const kaspaItem = item as KaspaActivityItem;
    const sign = kaspaItem.isIncoming ? '+' : '-';
    const amount = this.kaspaNetworkActionsService.sompiToNumber(
      kaspaItem.amount,
    );
    return `${sign}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}`;
  }

  getKrc20AmountDisplay(item: ActivityItem): string {
    const krc20Item = item as Krc20ActivityItem;
    const amount = this.kaspaNetworkActionsService.sompiToNumber(
      BigInt(krc20Item.amount),
    );
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`;
  }

  getErc20AmountDisplay(item: ActivityItem): string {
    const erc20Item = item as Erc20ActivityItem;
    const sign = erc20Item.isIncoming ? '+' : '-';
    const amount = this.formatErc20Amount(
      erc20Item.amount,
      erc20Item.tokenAddress,
    );
    return `${sign}${amount}`;
  }

  private formatErc20Amount(amount: string, tokenAddress: string): string {
    // For now, assume 18 decimals for ERC20 tokens
    // In a real implementation, you'd fetch the token's decimals
    const decimals = 18;
    const numericAmount = Number(BigInt(amount) / BigInt(10 ** decimals));

    return numericAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  }

  hasKaspaFee(item: ActivityItem): boolean {
    const kaspaItem = item as KaspaActivityItem;
    return kaspaItem.fee > 0n;
  }

  getKaspaFeeDisplay(item: ActivityItem): string {
    const kaspaItem = item as KaspaActivityItem;
    const fee = this.kaspaNetworkActionsService.sompiToNumber(kaspaItem.fee);
    return fee.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  }
}
