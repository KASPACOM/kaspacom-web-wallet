import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {  KcIconComponent } from 'kaspacom-ui';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { KaspaApiService } from '../../../../../services/kaspa-api/kaspa-api.service';
import { FullTransactionResponseItem } from '../../../../../services/kaspa-api/dtos/full-transaction-response.dto';
import { environment } from '../../../../../../environments/environment';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletService } from '../../../../../services/wallet.service';

@Component({
  selector: 'app-kaspa-transaction-details',
  imports: [
    CommonModule,
    KcIconComponent,
    SkeletonComponent,
    CopyButtonComponent
  ],
  templateUrl: './kaspa-transaction-details.component.html',
  styleUrl: './kaspa-transaction-details.component.scss'
})
export class KaspaTransactionDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private kaspaApiService = inject(KaspaApiService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private walletService = inject(WalletService);

  protected transactionId: string | null = null;
  protected transactionDetails = signal<FullTransactionResponseItem | null>(null);
  protected loading = signal<boolean>(true);

  ngOnInit(): void {
    this.transactionId = this.route.snapshot.paramMap.get('transactionId');

    if (this.transactionId) {
      this.loadTransactionDetails();
    } else {
      this.loading.set(false);
    }
  }

  private async loadTransactionDetails(): Promise<void> {
    if (!this.transactionId) return;

    try {
      this.loading.set(true);

      // Check if transaction data was passed via navigation state
      const navigationState = this.router.getCurrentNavigation()?.extras?.state;
      if (navigationState && navigationState['transactionData']) {
        this.transactionDetails.set(navigationState['transactionData']);
        this.loading.set(false);
        return;
      }

      // If no navigation state, try to get from history state
      const historyState = history.state;
      if (historyState && historyState['transactionData']) {
        this.transactionDetails.set(historyState['transactionData']);
        this.loading.set(false);
        return;
      }

      // If no transaction data is available, we can't load the details
      console.warn('No transaction data available for transaction ID:', this.transactionId);
      this.loading.set(false);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    this.router.navigate(['/app/activity']);
  }

  protected formatAmount(amount: bigint): string {
    const numAmount = this.kaspaNetworkActionsService.sompiToNumber(amount);
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    });
  }

  protected formatDate(timestamp: number): string {
    const date = new Date(timestamp); // Already in milliseconds
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 20)}...${address.slice(-8)}`;
  }

  protected getTransactionStatus(transaction: FullTransactionResponseItem): string {
    return transaction.is_accepted ? 'Accepted' : 'Pending';
  }

  protected openTransactionInExplorer(): void {
    const transaction = this.transactionDetails();
    if (transaction) {
      const explorerUrl = `${environment.kaspaExplorerBaseurl}/txs/${transaction.transaction_id}`;
      window.open(explorerUrl, '_blank');
    }
  }

  protected getTotalInputAmount(): bigint {
    const transaction = this.transactionDetails();
    if (!transaction) return 0n;

    return transaction.inputs.reduce((total, input) => {
      return total + BigInt(input.previous_outpoint_amount || 0);
    }, 0n);
  }

  protected getTotalOutputAmount(): bigint {
    const transaction = this.transactionDetails();
    if (!transaction) return 0n;

    return transaction.outputs.reduce((total, output) => {
      return total + BigInt(output.amount);
    }, 0n);
  }

  protected getTransactionFee(): bigint {
    return this.getTotalInputAmount() - this.getTotalOutputAmount();
  }

  protected getNetAmountForWallet(): { amount: bigint; isIncoming: boolean } {
    const transaction = this.transactionDetails();
    const currentWallet = this.walletService.getCurrentWallet();
    const walletAddress = currentWallet?.getAddress() || '';

    if (!transaction) return { amount: 0n, isIncoming: false };

    // Calculate input and output amounts for this wallet
    const inputAmount = transaction.inputs.reduce((total, input) => {
      if (input.previous_outpoint_address === walletAddress) {
        return total + BigInt(input.previous_outpoint_amount || 0);
      }
      return total;
    }, 0n);

    const outputAmount = transaction.outputs.reduce((total, output) => {
      if (output.script_public_key_address === walletAddress) {
        return total + BigInt(output.amount);
      }
      return total;
    }, 0n);

    const netAmount = outputAmount - inputAmount;
    return {
      amount: netAmount < 0n ? -netAmount : netAmount,
      isIncoming: netAmount > 0n
    };
  }

  protected formatInputAmount(amount: number | undefined): string {
    return this.formatAmount(BigInt(amount || 0));
  }

  protected formatOutputAmount(amount: number): string {
    return this.formatAmount(BigInt(amount));
  }

  protected getBlockHashDisplay(): string {
    const transaction = this.transactionDetails();
    if (!transaction?.block_hash || transaction.block_hash.length === 0) {
      return '';
    }
    // Return the first block hash if it's an array
    return Array.isArray(transaction.block_hash) ? transaction.block_hash[0] : transaction.block_hash;
  }
}
