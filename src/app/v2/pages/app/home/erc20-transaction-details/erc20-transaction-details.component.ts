import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { KcIconComponent, KcButtonComponent } from 'kaspacom-ui';
import { Erc20ActivityItem } from '../../activity/activity.component';

@Component({
  selector: 'app-erc20-transaction-details',
  standalone: true,
  imports: [CommonModule, KcIconComponent, KcButtonComponent],
  template: `
    <div
      class="transaction-details-container flex column full-width full-height p-24"
    >
      @if (transaction) {
        <!-- Header -->
        <div class="transaction-header mb-24">
          <div class="flex justify-content-between align-items-center mb-16">
            <h2 class="text-white typo-title-3">Transaction Details</h2>
            <kc-button
              variant="tertiary"
              size="sm"
              (click)="navigateBack()"
              icon="icon-arrow-left"
            >
              Back
            </kc-button>
          </div>

          <!-- Transaction Status -->
          <div class="transaction-status card-0 p-16 mb-16">
            <div class="flex align-items-center gap-12">
              <kc-icon
                [iconClass]="getStatusIcon()"
                [size]="'md'"
                [color]="getStatusColor()"
              >
              </kc-icon>
              <span class="text-white typo-text-2 font-weight-medium">
                {{ getStatusText() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Transaction Details -->
        <div class="transaction-details card-0 p-24">
          <!-- Amount -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">Amount</div>
            <div class="detail-value text-white typo-text-1 font-weight-medium">
              <span [style.color]="getAmountColor()">
                {{ getAmountDisplay() }}
              </span>
              <span class="ml-8">{{ transaction.tokenSymbol || 'TOKEN' }}</span>
            </div>
          </div>

          <!-- Token Address -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">Token</div>
            <div class="detail-value text-white typo-text-1">
              <div class="flex align-items-center gap-8">
                <kc-icon [iconClass]="'icon-tokens'" [size]="'sm'"></kc-icon>
                <span>{{ transaction.tokenName || 'Unknown Token' }}</span>
                <span class="text-gray-60"
                  >({{ shortenAddress(transaction.tokenAddress) }})</span
                >
              </div>
            </div>
          </div>

          <!-- From Address -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">
              {{ transaction.isIncoming ? 'From' : 'From' }}
            </div>
            <div class="detail-value text-white typo-text-1">
              <div class="flex align-items-center gap-8">
                <kc-icon
                  [iconClass]="'icon-arrow-up'"
                  [size]="'sm'"
                  [color]="'var(--red-20)'"
                ></kc-icon>
                <span>{{ shortenAddress(transaction.fromAddress || '') }}</span>
                <kc-button
                  variant="tertiary"
                  size="sm"
                  icon="icon-copy"
                  (click)="copyToClipboard(transaction.fromAddress || '')"
                >
                </kc-button>
              </div>
            </div>
          </div>

          <!-- To Address -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">
              {{ transaction.isIncoming ? 'To' : 'To' }}
            </div>
            <div class="detail-value text-white typo-text-1">
              <div class="flex align-items-center gap-8">
                <kc-icon
                  [iconClass]="'icon-arrow-down'"
                  [size]="'sm'"
                  [color]="'var(--green-20)'"
                ></kc-icon>
                <span>{{ shortenAddress(transaction.toAddress || '') }}</span>
                <kc-button
                  variant="tertiary"
                  size="sm"
                  icon="icon-copy"
                  (click)="copyToClipboard(transaction.toAddress || '')"
                >
                </kc-button>
              </div>
            </div>
          </div>

          <!-- Transaction Hash -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">
              Transaction Hash
            </div>
            <div class="detail-value text-white typo-text-1">
              <div class="flex align-items-center gap-8">
                <span>{{ shortenHash(transaction.id) }}</span>
                <kc-button
                  variant="tertiary"
                  size="sm"
                  icon="icon-copy"
                  (click)="copyToClipboard(transaction.id)"
                >
                </kc-button>
              </div>
            </div>
          </div>

          <!-- Timestamp -->
          <div class="detail-row mb-20">
            <div class="detail-label text-gray-60 typo-text-2">Timestamp</div>
            <div class="detail-value text-white typo-text-1">
              {{ formatTimestamp(transaction.timestamp) }}
            </div>
          </div>

          <!-- Gas Used (if available) -->
          @if (transaction.gasUsed) {
            <div class="detail-row mb-20">
              <div class="detail-label text-gray-60 typo-text-2">Gas Used</div>
              <div class="detail-value text-white typo-text-1">
                {{ formatGas(transaction.gasUsed) }}
              </div>
            </div>
          }

          <!-- Gas Price (if available) -->
          @if (transaction.gasPrice) {
            <div class="detail-row">
              <div class="detail-label text-gray-60 typo-text-2">Gas Price</div>
              <div class="detail-value text-white typo-text-1">
                {{ formatGasPrice(transaction.gasPrice) }} wei
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- Loading or Not Found -->
        <div
          class="flex column align-items-center justify-content-center full-height"
        >
          <kc-icon
            [iconClass]="'icon-clock'"
            [size]="'xlg'"
            [color]="'var(--gray-60)'"
          ></kc-icon>
          <h3 class="text-gray-60 typo-title-3 mt-16">Transaction Not Found</h3>
        </div>
      }
    </div>
  `,
  styleUrl: './erc20-transaction-details.component.scss',
})
export class Erc20TransactionDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  transaction: Erc20ActivityItem | null = null;

  ngOnInit() {
    // Get transaction data from route state
    const state = history.state;
    if (state?.transactionData) {
      this.transaction = state.transactionData;
    }
  }

  navigateBack() {
    this.router.navigate(['/app/activity']);
  }

  getStatusIcon(): string {
    switch (this.transaction?.status) {
      case 'accepted':
        return 'icon-check-circle';
      case 'pending':
        return 'icon-clock';
      case 'rejected':
        return 'icon-x-circle';
      default:
        return 'icon-help-circle';
    }
  }

  getStatusColor(): string {
    switch (this.transaction?.status) {
      case 'accepted':
        return 'var(--green-20)';
      case 'pending':
        return 'var(--orange-20)';
      case 'rejected':
        return 'var(--red-20)';
      default:
        return 'var(--gray-60)';
    }
  }

  getStatusText(): string {
    switch (this.transaction?.status) {
      case 'accepted':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  getAmountColor(): string {
    return this.transaction?.isIncoming ? 'var(--green-20)' : 'var(--red-20)';
  }

  getAmountDisplay(): string {
    if (!this.transaction) return '0';

    const decimals = 18; // Default ERC20 decimals
    const amount = Number(
      BigInt(this.transaction.amount) / BigInt(10 ** decimals),
    );

    return `${this.transaction.isIncoming ? '+' : '-'}${amount.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      },
    )}`;
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatGas(gasUsed: string): string {
    return parseInt(gasUsed).toLocaleString('en-US');
  }

  formatGasPrice(gasPrice: string): string {
    return parseInt(gasPrice).toLocaleString('en-US');
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  shortenHash(hash: string): string {
    return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  }
}
