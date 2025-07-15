import { Component, Input, signal, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { WalletService } from '../../../../../services/wallet.service';

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
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent
  ],
  template: `
    <div class="asset-page-container full-width full-height column p-16">
      <!-- Header with back button -->
      <div class="asset-header flex align-items-center gap-16 mb-24">
        <kc-icon 
          [iconClass]="'icon-arrow-left'"
          [size]="'md'"
          (click)="goBack()"
          class="cursor-pointer">
        </kc-icon>
        <h1 class="asset-title">{{ assetDetail()?.name || 'Loading...' }}</h1>
      </div>

      <!-- Asset Details Card -->
      <div class="asset-details-card bg-surface border-radius-12 p-16 mb-24">
        @if (loading()) {
          <app-skeleton [height]="'60px'" class="mb-16"></app-skeleton>
          <app-skeleton [height]="'40px'"></app-skeleton>
        } @else {
          <div class="asset-balance text-center">
            <div class="balance-amount text-large font-weight-bold">
              {{ formatBalance() }}
            </div>
            <div class="balance-symbol text-medium text-secondary">
              {{ assetDetail()?.symbol | uppercase }}
            </div>
          </div>
        }
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons flex gap-12 mb-24">
        <kc-button 
          [variant]="'primary'"
          [size]="'md'"
          class="flex-1"
          (click)="onSendAction()">
          Send
        </kc-button>
        <!-- Can add more action buttons here -->
      </div>

      <!-- Transaction History -->
      <div class="transaction-history flex-1">
        <h3 class="history-title mb-16">Transaction History</h3>
        
        <div class="transaction-list bg-surface border-radius-12 overflow-hidden">
          @if (historyLoading()) {
            @for (item of [1,2,3,4,5]; track item) {
              <div class="transaction-item p-16 border-bottom">
                <app-skeleton [height]="'20px'" class="mb-8"></app-skeleton>
                <app-skeleton [height]="'16px'" [width]="'60%'"></app-skeleton>
              </div>
            }
          } @else if (transactions().length === 0) {
            <div class="no-transactions text-center p-24 text-secondary">
              No transactions found
            </div>
          } @else {
            @for (transaction of transactions(); track transaction.id) {
              <div class="transaction-item p-16 border-bottom-light hover:bg-hover cursor-pointer">
                <div class="transaction-content flex justify-content-between align-items-center">
                  <div class="transaction-info">
                    <div class="transaction-type font-weight-medium">
                      {{ transaction.type | titlecase }}
                    </div>
                    <div class="transaction-details text-small text-secondary">
                      {{ formatTransactionDetails(transaction) }}
                    </div>
                  </div>
                  <div class="transaction-amount text-right">
                    <div class="amount font-weight-medium">
                      {{ formatTransactionAmount(transaction) }}
                    </div>
                    <div class="timestamp text-small text-secondary">
                      {{ formatTimestamp(transaction.timestamp) }}
                    </div>
                  </div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './base-asset-page.component.scss'
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
      maximumFractionDigits: detail.decimals || 0
    });
  }

  protected formatTransactionAmount(transaction: AssetTransaction): string {
    const amount = parseFloat(transaction.amount);
    const sign = transaction.type === 'transfer' && transaction.from === this.getCurrentWalletAddress() ? '-' : '+';
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
      minute: '2-digit'
    });
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  protected getCurrentWalletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }
} 