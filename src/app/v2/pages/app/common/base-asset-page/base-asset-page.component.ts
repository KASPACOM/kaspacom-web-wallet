import { CommonModule, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KcButtonComponent } from 'kaspacom-ui';
import { KcIconComponent } from '@kaspacom/ui-kit';
import { WalletService } from '../../../../../services/wallet.service';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

export interface AssetTransaction {
  id: string;
  type: string;
  amount: string;
  from?: string;
  to?: string;
  timestamp: string;
  status: string;
}

export interface AssetDetail {
  name: string;
  symbol: string;
  balance: string;
  decimals?: number;
}

@Component({
  selector: 'app-base-asset-page',
  imports: [
    CommonModule,
    TitleCasePipe,
    UpperCasePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent,
  ],
  templateUrl: './base-asset-page.component.html',
  styleUrl: './base-asset-page.component.scss',
})
export class BaseAssetPageComponent implements OnInit {
  protected router = inject(Router);
  protected walletService = inject(WalletService);

  // Signals for reactive state
  protected assetDetail = signal<AssetDetail | null>(null);
  protected transactions = signal<AssetTransaction[]>([]);
  protected loading = signal<boolean>(true);
  protected historyLoading = signal<boolean>(true);

  ngOnInit() {
    this.loadAssetData();
    this.loadTransactionHistory();
  }

  // Template methods that child classes should override
  protected async loadAssetData(): Promise<void> {
    // Override in child classes
    this.loading.set(false);
  }

  protected async loadTransactionHistory(): Promise<void> {
    // Override in child classes
    this.historyLoading.set(false);
  }

  protected onSendAction(): void {
    // Override in child classes or implement navigation to send form
    console.log('Send action triggered for:', this.assetDetail()?.symbol);
  }

  // Helper methods
  protected goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.router.routerState.root });
  }

  protected formatBalance(): string {
    const detail = this.assetDetail();
    if (!detail) return '0';

    const balance = parseFloat(detail.balance);
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: detail.decimals || 0,
    });
  }

  protected formatTransactionAmount(transaction: AssetTransaction): string {
    const amount = parseFloat(transaction.amount);
    const sign =
      transaction.type === 'transfer' &&
      transaction.from === this.getCurrentWalletAddress()
        ? '-'
        : '+';
    return `${sign}${amount.toLocaleString()}`;
  }

  protected formatTransactionDetails(transaction: AssetTransaction): string {
    const currentAddress = this.getCurrentWalletAddress();
    if (transaction.type === 'transfer') {
      if (transaction.from === currentAddress) {
        return `To: ${this.shortenAddress(transaction.to || '')}`;
      } else {
        return `From: ${this.shortenAddress(transaction.from || '')}`;
      }
    }
    return transaction.type;
  }

  protected formatTimestamp(timestamp: string): string {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  protected getCurrentWalletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }
}
