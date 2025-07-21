import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { BaseAssetPageComponent, AssetDetail, AssetTransaction } from '../../common/base-asset-page/base-asset-page.component';
import { KasplexKrc20Service } from '../../../../../services/kasplex-api/kasplex-api.service';
import { OperationDetails } from '../../../../../services/kasplex-api/dtos/operation-details-response';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { AssetsStoreService } from '../../../../../services/assets-store.service';

@Component({
  selector: 'app-krc20-asset',
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent
  ],
  templateUrl: './krc20-asset.component.html',
  styleUrl: './krc20-asset.component.scss'
})
export class Krc20AssetComponent extends BaseAssetPageComponent implements OnInit {
  protected kasplexService = inject(KasplexKrc20Service);
  protected route = inject(ActivatedRoute);
  private assetsStore = inject(AssetsStoreService);
  
  ticker: string | null = null;

  override ngOnInit() {
    this.ticker = this.route.snapshot.paramMap.get('ticker');
    this.loadAssetData();
    this.loadTransactionHistory();
  }

  protected override async loadAssetData(): Promise<void> {
    if (!this.ticker) {
      this.loading.set(false);
      return;
    }

    try {
      this.loading.set(true);
      
      // First try to get the token from the assets store
      const krc20Assets = this.assetsStore.krc20Assets();
      const storedToken = krc20Assets.find(token => token.tick === this.ticker);
      
      if (storedToken) {
        // Use data from store
        const assetDetail: AssetDetail = {
          name: storedToken.tick.toUpperCase(),
          symbol: storedToken.tick.toUpperCase(),
          balance: storedToken.balance.toString(),
          decimals: storedToken.decimals
        };
        this.assetDetail.set(assetDetail);
      } else {
        // Fallback to API if not in store (shouldn't happen in normal flow)
        const currentWallet = this.walletService.getCurrentWallet();
        
        if (!currentWallet) {
          console.warn('No current wallet selected');
          return;
        }

        // Get token info and user balance in parallel
        const [tokenInfoResponse, userBalanceResponse] = await Promise.all([
          firstValueFrom(this.kasplexService.getTokenInfo(this.ticker)),
          firstValueFrom(this.kasplexService.getTokenWalletBalanceInfo(currentWallet.getAddress(), this.ticker))
        ]);

        const tokenInfo = tokenInfoResponse.result?.[0];
        const userBalance = userBalanceResponse.result?.[0];

        if (tokenInfo && userBalance) {
          const assetDetail: AssetDetail = {
            name: tokenInfo.tick.toUpperCase(),
            symbol: tokenInfo.tick.toUpperCase(),
            balance: userBalance.balance,
            decimals: parseInt(tokenInfo.dec || '0')
          };

          this.assetDetail.set(assetDetail);
        }
      }
    } catch (error) {
      console.error('Failed to load KRC20 asset data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected override async loadTransactionHistory(): Promise<void> {
    if (!this.ticker) {
      this.historyLoading.set(false);
      return;
    }

    try {
      this.historyLoading.set(true);
      const currentWallet = this.walletService.getCurrentWallet();
      
      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      const operationsResponse = await firstValueFrom(
        this.kasplexService.getWalletOperationHistory(currentWallet.getAddress(), this.ticker)
      );

      if (operationsResponse.message === 'successful' && operationsResponse.result) {
        const transactions: AssetTransaction[] = operationsResponse.result.map((operation: OperationDetails) => ({
          id: operation.hashRev,
          type: operation.op,
          amount: operation.amt || '0',
          from: operation.from,
          to: operation.to,
          timestamp: operation.mtsAdd,
          status: operation.opAccept === '1' ? 'accepted' : 'rejected'
        }));

        this.transactions.set(transactions);
      }
    } catch (error) {
      console.error('Failed to load KRC20 transaction history:', error);
    } finally {
      this.historyLoading.set(false);
    }
  }

  protected override onSendAction(): void {
    // TODO: Navigate to send KRC20 form
    console.log('Send KRC20 action triggered for:', this.ticker);
    // In the future, this could navigate to a send form with the ticker pre-filled
    // this.router.navigate(['../send'], { 
    //   relativeTo: this.route,
    //   queryParams: { ticker: this.ticker, type: 'krc20' }
    // });
  }

  // Helper method to determine if transaction amount is positive or negative
  protected isTransactionPositive(transaction: AssetTransaction): boolean {
    return !(transaction.type === 'transfer' && transaction.from === this.getCurrentWalletAddress());
  }

  // Override the goBack method to navigate properly
  protected override goBack(): void {
    this.router.navigate(['/app/home']);
  }
} 