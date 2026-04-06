import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Transaction, formatUnits } from 'ethers';
import { KcIconComponent, KcSpinnerComponent } from 'kaspacom-ui';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { L2TransactionHistory } from '../../../../../../../db/dtos/l2-transaction-history';
import { L2TransactionHistoryService } from '../../../../../../../services/l2-services/l2-transaction-history.service';
import { EthereumWalletChainManager } from '../../../../../../../services/etherium-services/etherium-wallet-chain.manager';

export type L2TxStatus = 'pending' | 'success' | 'failed';

@Component({
  selector: 'app-l2-tx-history',
  standalone: true,
  imports: [CommonModule, KcIconComponent, KcSpinnerComponent, CopyButtonComponent],
  templateUrl: './l2-tx-history.component.html',
  styleUrl: './l2-tx-history.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class L2TxHistoryComponent {
  private l2TxHistoryService = inject(L2TransactionHistoryService);
  private chainManager = inject(EthereumWalletChainManager);
  private txDataCache = new Map<string, Transaction | null>();

  transactions = this.l2TxHistoryService.getTransactionHistorySignal();
  expandedHash = signal<string | null>(null);

  constructor() {
    // Clear cache when transactions list resets (wallet/network change)
    effect(() => {
      this.transactions(); // track signal
      this.txDataCache.clear();
    });
  }

  hasTransactions = computed(() => this.transactions().length > 0);

  getStatus(tx: L2TransactionHistory): L2TxStatus {
    if (!tx.receiptInfo) return 'pending';
    return tx.receiptInfo.status === 1 ? 'success' : 'failed';
  }

  toggleExpand(hash: string): void {
    this.expandedHash.update((current) => (current === hash ? null : hash));
  }

  isExpanded(hash: string): boolean {
    return this.expandedHash() === hash;
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
    const cached = this.txDataCache.get(tx.hash);
    if (cached !== undefined) return cached;
    try {
      const result = this.l2TxHistoryService.getInfoFromTransactionData(tx.transactionData);
      this.txDataCache.set(tx.hash, result);
      return result;
    } catch {
      this.txDataCache.set(tx.hash, null);
      return null;
    }
  }

  getToAddress(tx: L2TransactionHistory): string | null {
    const txData = this.getTxData(tx);
    return txData?.to ?? null;
  }

  private getNativeCurrency(): { decimals: number; symbol: string } {
    const config = this.chainManager.getCurrentWalletProvider()?.getConfig();
    return {
      decimals: config?.nativeCurrency?.decimals ?? 18,
      symbol: config?.nativeCurrency?.symbol ?? 'KAS',
    };
  }

  getFormattedValue(tx: L2TransactionHistory): string {
    const { decimals, symbol } = this.getNativeCurrency();
    try {
      const txData = this.getTxData(tx);
      if (txData === null) return '—';
      if (!txData.value) return `0 ${symbol}`;
      const formatted = formatUnits(txData.value, decimals);
      const num = parseFloat(formatted);
      if (num === 0) return `0 ${symbol}`;
      return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })} ${symbol}`;
    } catch {
      return '—';
    }
  }

  getGasFee(tx: L2TransactionHistory): string {
    if (!tx.receiptInfo) return '—';
    const { decimals, symbol } = this.getNativeCurrency();
    try {
      const fee = parseFloat(formatUnits(tx.receiptInfo.fee, decimals));
      return `${fee.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${symbol}`;
    } catch {
      return '—';
    }
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
