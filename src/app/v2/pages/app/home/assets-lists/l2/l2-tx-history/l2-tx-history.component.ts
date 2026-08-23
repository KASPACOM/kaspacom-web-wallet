import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Transaction, formatUnits } from 'ethers';
import { KcIconComponent, KcSpinnerComponent } from '@kaspacom/ui-kit';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
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
  private parseWarningHashes = new Set<string>();

  transactions = this.l2TxHistoryService.getTransactionHistorySignal();
  historyLoading = this.l2TxHistoryService.getTransactionHistoryLoadingSignal();
  expandedHash = signal<string | null>(null);
  private lastTxHashKey: string | null = null;

  constructor() {
    // Clear cache only when the set of transaction hashes changes (wallet/network switch),
    // not on every signal update (e.g. receipt info updates)
    effect(() => {
      const key = this.transactions().map(tx => tx.hash).sort().join('|');
      if (this.lastTxHashKey !== key) {
        this.txDataCache.clear();
        this.parseWarningHashes.clear();
        this.lastTxHashKey = key;
      }
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

  onCardKeydown(event: KeyboardEvent, hash: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleExpand(hash);
    }
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
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
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
    } catch (error) {
      if (!this.parseWarningHashes.has(tx.hash)) {
        this.parseWarningHashes.add(tx.hash);
        console.warn('Failed to parse L2 transaction data', {
          hash: tx.hash,
          chainId: tx.chainId,
          error,
        });
      }
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
      return `${this.formatDecimalString(formatted, 6)} ${symbol}`;
    } catch (error) {
      console.warn('Failed to format L2 transaction value', {
        hash: tx.hash,
        decimals,
        symbol,
        error,
      });
      return '—';
    }
  }

  getGasFee(tx: L2TransactionHistory): string {
    if (!tx.receiptInfo) return '—';
    const { decimals, symbol } = this.getNativeCurrency();
    try {
      const fee = formatUnits(tx.receiptInfo.fee, decimals);
      return `${this.formatDecimalString(fee, 8)} ${symbol}`;
    } catch (error) {
      console.warn('Failed to format L2 gas fee', {
        hash: tx.hash,
        decimals,
        symbol,
        fee: tx.receiptInfo.fee,
        error,
      });
      return '—';
    }
  }

  private formatDecimalString(value: string, maxFractionDigits: number): string {
    const negative = value.startsWith('-');
    const normalized = negative ? value.slice(1) : value;
    const [integerPartRaw, fractionPartRaw = ''] = normalized.split('.');
    const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '') || '0';
    const fractionPart = fractionPartRaw.slice(0, maxFractionDigits).replace(/0+$/, '');
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const result = fractionPart ? `${groupedInteger}.${fractionPart}` : groupedInteger;
    return negative ? `-${result}` : result;
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
