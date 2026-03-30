import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transaction } from 'ethers';
import { KcIconComponent, KcSpinnerComponent } from 'kaspacom-ui';
import { L2TransactionHistory } from '../../../../../../../db/dtos/l2-transaction-history';
import { L2TransactionHistoryService } from '../../../../../../../services/l2-services/l2-transaction-history.service';

export type L2TxStatus = 'pending' | 'success' | 'failed';

@Component({
  selector: 'app-l2-tx-history',
  standalone: true,
  imports: [CommonModule, KcIconComponent, KcSpinnerComponent],
  templateUrl: './l2-tx-history.component.html',
  styleUrl: './l2-tx-history.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class L2TxHistoryComponent {
  private l2TxHistoryService = inject(L2TransactionHistoryService);

  transactions = this.l2TxHistoryService.getTransactionHistorySignal();
  expandedId = signal<number | null>(null);

  hasTransactions = computed(() => this.transactions().length > 0);

  getStatus(tx: L2TransactionHistory): L2TxStatus {
    if (!tx.receiptInfo) return 'pending';
    return tx.receiptInfo.status === 1 ? 'success' : 'failed';
  }

  toggleExpand(id: number | undefined): void {
    if (id === undefined) return;
    this.expandedId.update((current) => (current === id ? null : id));
  }

  isExpanded(id: number | undefined): boolean {
    return id !== undefined && this.expandedId() === id;
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  shortenAddress(address: string | null | undefined): string {
    if (!address) return '—';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  shortenHash(hash: string): string {
    if (!hash) return '—';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  getTxData(tx: L2TransactionHistory): Transaction | null {
    try {
      return this.l2TxHistoryService.getInfoFromTransactionData(tx.transactionData);
    } catch {
      return null;
    }
  }

  getToAddress(tx: L2TransactionHistory): string {
    const txData = this.getTxData(tx);
    return txData?.to ?? '—';
  }

  getFormattedValue(tx: L2TransactionHistory): string {
    try {
      const txData = this.getTxData(tx);
      if (!txData?.value) return '0 KAS';
      const valueInEth = Number(txData.value) / 1e18;
      if (valueInEth === 0) return '0 KAS';
      return `${valueInEth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })} KAS`;
    } catch {
      return '— KAS';
    }
  }

  getGasFee(tx: L2TransactionHistory): string {
    if (!tx.receiptInfo) return '—';
    try {
      const fee = Number(tx.receiptInfo.fee) / 1e18;
      return `${fee.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} KAS`;
    } catch {
      return '—';
    }
  }

  copyToClipboard(text: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
