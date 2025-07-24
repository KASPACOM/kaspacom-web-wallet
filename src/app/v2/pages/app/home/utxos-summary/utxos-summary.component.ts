import { Component, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../services/wallet-action.service';
import { SompiToNumberPipe } from '../../../../../pipes/sompi-to-number.pipe';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { Router } from '@angular/router';
import { UtxoEntryReference } from '../../../../../../../public/kaspa/kaspa';

@Component({
  selector: 'app-utxos-summary',
  imports: [
    CommonModule,
    DecimalPipe,
    KcButtonComponent,
    KcIconComponent,
    SompiToNumberPipe,
    CommaFormatterPipe,
    SkeletonComponent,
    CopyButtonComponent
  ],
  templateUrl: './utxos-summary.component.html',
  styleUrl: './utxos-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class UtxosSummaryComponent {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private router = inject(Router);

  // Get current wallet and its UTXOs
  currentWallet = computed(() => this.walletService.getCurrentWallet());
  
  // Get UTXOs from wallet balance
  utxos = computed(() => {
    const wallet = this.currentWallet();
    if (!wallet) return [];
    const balance = wallet.getBalanceSignal()();
    return balance?.utxoEntries || [];
  });

  // Check if data is loading
  loading = computed(() => {
    const wallet = this.currentWallet();
    if (!wallet) return true;
    const balance = wallet.getBalanceSignal()();
    return !balance;
  });

  // Check if compound button should be shown (more than 1 UTXO)
  canCompound = computed(() => this.utxos().length > 1);

  // Get total number of UTXOs
  utxoCount = computed(() => this.utxos().length);

  async compoundUtxos() {
    try {
      await this.walletActionService.validateAndDoActionAfterApproval(
        this.walletActionService.createCompoundUtxosAction()
      );
    } catch (error) {
      console.error('Failed to compound UTXOs:', error);
    }
  }

  // Format transaction ID for display (show first 8 and last 8 characters)
  formatTransactionId(txId: string): string {
    if (txId.length <= 16) return txId;
    return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`;
  }

  // Convert UTXO amount to display number
  formatUtxoAmount(amount: bigint): number {
    // Convert sompi to KAS (divide by 100,000,000)
    return Number(amount) / 100000000;
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByUtxo(index: number, utxo: any): string {
    return `${utxo.outpoint.transactionId}-${utxo.outpoint.index}`;
  }

  // Navigate to UTXO detail page
  openUtxoDetail(utxo: UtxoEntryReference): void {
    this.router.navigate(['/app/home/asset/utxo', utxo.outpoint.transactionId]);
  }
} 