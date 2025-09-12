import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { KcIconComponent } from '@kaspacom/ui';
import { BaseAssetPageComponent, AssetDetail } from '../../common/base-asset-page/base-asset-page.component';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { UtxoEntryReference } from '../../../../../../../public/kaspa/kaspa';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-utxo-asset',
  imports: [
    CommonModule,
    KcIconComponent,
    CopyButtonComponent,
    SkeletonComponent
  ],
  templateUrl: './utxo-asset.component.html',
  styleUrl: './utxo-asset.component.scss'
})
export class UtxoAssetComponent extends BaseAssetPageComponent implements OnInit {
  protected route = inject(ActivatedRoute);

  private transactionId: string = '';
  protected utxo = computed<UtxoEntryReference | null>(() => {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet || !this.transactionId) return null;

    const balance = wallet.getBalanceSignal()();
    if (!balance?.utxoEntries) return null;

    return balance.utxoEntries.find(utxo =>
      utxo.outpoint.transactionId === this.transactionId
    ) || null;
  });

  override ngOnInit() {
    this.transactionId = this.route.snapshot.paramMap.get('txId') || '';
    if (this.transactionId) {
      this.loadAssetData();
      // UTXOs don't have transaction history in the traditional sense
      this.historyLoading.set(false);
    }
  }

  protected override async loadAssetData(): Promise<void> {
    try {
      this.loading.set(true);

      const utxoData = this.utxo();

      if (utxoData) {
        // Convert UTXO data to AssetDetail format
        const kasAmount = Number(utxoData.amount) / 100000000;
        const assetDetail: AssetDetail = {
          name: 'UTXO Transaction',
          symbol: 'KAS',
          balance: kasAmount.toFixed(3),
          decimals: 3
        };
        this.assetDetail.set(assetDetail);
      }
    } catch (error) {
      console.error('Failed to load UTXO asset data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected override async loadTransactionHistory(): Promise<void> {
    // UTXOs don't have transaction history, so we skip this
    this.transactions.set([]);
    this.historyLoading.set(false);
  }

  protected override onSendAction(): void {
    // Could implement UTXO-specific send logic here if needed
    console.log('Send action for UTXO not implemented yet');
  }

  // UTXO-specific helper methods
  formatAmount(): string {
    const utxoData = this.utxo();
    if (!utxoData) return '0.000';

    const kasAmount = Number(utxoData.amount) / 100000000;
    return kasAmount.toFixed(3);
  }

  getAddress(): string {
    const utxoData = this.utxo();
    if (!utxoData?.address) return 'N/A';
    return utxoData.address.toString();
  }

  getTransactionId(): string {
    const utxoData = this.utxo();
    if (!utxoData?.outpoint) return 'N/A';
    return utxoData.outpoint.transactionId;
  }

  getScriptPublicKey(): string {
    const utxoData = this.utxo();
    if (!utxoData?.scriptPublicKey) return 'N/A';
    return utxoData.scriptPublicKey.toString();
  }

  getBlockDaaScore(): string {
    const utxoData = this.utxo();
    if (!utxoData) return 'N/A';
    return utxoData.blockDaaScore.toString();
  }

  getIsCoinbase(): string {
    const utxoData = this.utxo();
    if (!utxoData) return 'false';
    return utxoData.isCoinbase.toString();
  }

  openInExplorer(): void {
    const utxoData = this.utxo();
    if (!utxoData?.outpoint?.transactionId) return;

    const explorerUrl = `${environment.kaspaExplorerBaseurl}/txs/${utxoData.outpoint.transactionId}`;
    window.open(explorerUrl, '_blank');
  }

  // Override the goBack method to navigate properly
  protected override goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'utxos' } });
  }
}
