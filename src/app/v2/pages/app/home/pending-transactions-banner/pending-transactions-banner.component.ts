
import { Component, computed, inject, signal } from '@angular/core';
import { KcIconComponent, KcSpinnerComponent } from 'kaspacom-ui';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletService } from '../../../../../services/wallet.service';

@Component({
  selector: 'app-pending-transactions-banner',
  standalone: true,
  imports: [KcIconComponent, KcSpinnerComponent],
  templateUrl: './pending-transactions-banner.component.html',
  styleUrl: './pending-transactions-banner.component.scss',
})
export class PendingTransactionsBannerComponent {
  private walletService = inject(WalletService);
  private kaspaNetworkService = inject(KaspaNetworkActionsService);

  isExpanded = signal(false);

  currentWallet = computed(() => this.walletService.getCurrentWallet());

  mempoolData = computed(() => {
    const wallet = this.currentWallet();
    return wallet?.getMempoolTransactionsSignalValue();
  });

  hasPendingTransactions = computed(() => {
    const data = this.mempoolData();
    return data ? data.sending.length > 0 || data.receiving.length > 0 : false;
  });

  totalPendingCount = computed(() => {
    const data = this.mempoolData();
    return data ? data.sending.length + data.receiving.length : 0;
  });

  sendingCount = computed(() => this.mempoolData()?.sending.length || 0);
  receivingCount = computed(() => this.mempoolData()?.receiving.length || 0);

  toggleExpanded() {
    this.isExpanded.update((v) => !v);
  }

  formatTransactionId(txId: string): string {
    if (!txId || txId.length <= 16) return txId || '';
    return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`;
  }

  formatAmount(amount: bigint): string {
    try {
      return this.kaspaNetworkService.sompiToNumber(amount).toFixed(4);
    } catch {
      return '0.0000';
    }
  }

  getTransactionId(transaction: any): string {
    try {
      return transaction?.transaction?.id || 'Pending...';
    } catch {
      return 'Pending...';
    }
  }

  getTransactionAmount(transaction: any): bigint {
    try {
      if (!transaction?.transaction?.outputs) return 0n;
      return transaction.transaction.outputs.reduce((sum: bigint, out: any) => {
        const value = out?.value || 0n;
        return sum + (typeof value === 'bigint' ? value : BigInt(value));
      }, 0n);
    } catch {
      return 0n;
    }
  }
}
