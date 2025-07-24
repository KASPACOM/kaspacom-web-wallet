import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { BaseAssetPageComponent, AssetDetail, AssetTransaction } from '../../common/base-asset-page/base-asset-page.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { KasplexKrc20Service } from '../../../../../services/kasplex-api/kasplex-api.service';
import { AssetsStoreService } from '../../../../../services/assets-store.service';
import { FlowPagesService } from '../../common/services/flow-pages.service';
import { OperationDetails } from '../../../../../services/kasplex-api/dtos/operation-details-response';
import { environment } from '../../../../../../environments/environment';
import { KcLabeledTabsComponent, TabItem } from '../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { GetTokenInfoResponse } from '../../../../../services/kasplex-api/dtos/token-list-info.dto';
import { TokenLogoComponent } from '../../common/token-logo/token-logo.component';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

interface TokenInfo {
  tick: string;
  max: string;
  lim: string;
  pre: string;
  dec: string;
  minted: string;
  state: string;
  holderTotal: string;
  transferTotal: string;
  mintTotal: string;
  opScoreAdd: string;
  opScoreMod: string;
}

@Component({
  selector: 'app-krc20-asset',
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent,
    TokenLogoComponent,
    KcLabeledTabsComponent
  ],
  templateUrl: './krc20-asset.component.html',
  styleUrl: './krc20-asset.component.scss'
})
export class Krc20AssetComponent extends BaseAssetPageComponent implements OnInit {
  protected kasplexService = inject(KasplexKrc20Service);
  protected route = inject(ActivatedRoute);
  private assetsStore = inject(AssetsStoreService);
  private flowPagesService = inject(FlowPagesService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  
  ticker: string | null = null;
  
  // Tab management
  selectedTabId = signal<string>('transactions');
  tabs: TabItem[] = [
    { id: 'transactions', label: 'Transactions' },
    { id: 'token-info', label: 'Token Info' }
  ];
  
  // Token metadata
  protected tokenInfo = signal<TokenInfo | null>(null);
  protected tokenInfoLoading = signal<boolean>(true);

  override ngOnInit() {
    this.ticker = this.route.snapshot.paramMap.get('ticker');
    this.loadAssetData();
    this.loadTransactionHistory();
    this.loadTokenInfo();
  }

  // Tab change handler
  onTabChange(tabId: string) {
    this.selectedTabId.set(tabId);
  }

  // Load detailed token information
  protected async loadTokenInfo(): Promise<void> {
    if (!this.ticker) {
      this.tokenInfoLoading.set(false);
      return;
    }

    try {
      this.tokenInfoLoading.set(true);
      
      const tokenInfoResponse = await firstValueFrom(
        this.kasplexService.getTokenInfo(this.ticker)
      );

      if (tokenInfoResponse.message === 'successful' && tokenInfoResponse.result?.[0]) {
        const tokenData = tokenInfoResponse.result[0];
        
        const tokenInfo: TokenInfo = {
          tick: tokenData.tick,
          max: tokenData.max,
          lim: tokenData.lim,
          pre: tokenData.pre,
          dec: tokenData.dec,
          minted: tokenData.minted,
          state: tokenData.state,
          holderTotal: tokenData.holderTotal,
          transferTotal: tokenData.transferTotal,
          mintTotal: tokenData.mintTotal,
          opScoreAdd: tokenData.opScoreAdd,
          opScoreMod: tokenData.opScoreMod
        };

        this.tokenInfo.set(tokenInfo);
      }
    } catch (error) {
      console.error('Failed to load token info:', error);
    } finally {
      this.tokenInfoLoading.set(false);
    }
  }

  // Helper method to format large numbers
  protected formatNumber(value: string | undefined): string {
    if (!value || value === '0') return '0';
    return parseInt(value).toLocaleString();
  }

  // Helper method to calculate percentage
  protected calculatePercentage(part: string | undefined, total: string | undefined): string {
    if (!part || !total || total === '0') return '0';
    const percentage = (parseInt(part) / parseInt(total)) * 100;
    return percentage.toFixed(2);
  }

  // Helper method to get state display
  protected getStateDisplay(): string {
    const tokenInfo = this.tokenInfo();
    if (!tokenInfo) return '';
    
    if (tokenInfo.state === 'finished') {
      const percentage = this.calculatePercentage(tokenInfo.minted, tokenInfo.max);
      return `${percentage}% Minted`;
    }
    
    return tokenInfo.state === 'deployed' ? 'Active' : tokenInfo.state;
  }

  // Helper method to calculate burned amount (max - minted)
  protected getBurnedAmount(): string {
    const tokenInfo = this.tokenInfo();
    if (!tokenInfo) return '0';
    
    const maxSupply = parseInt(tokenInfo.max || '0');
    const minted = parseInt(tokenInfo.minted || '0');
    const burned = Math.max(0, maxSupply - minted);
    
    return burned.toLocaleString();
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
          timestamp: operation.mtsAdd, // Keep as string for consistency with AssetTransaction interface
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
    if (!this.ticker || !this.assetDetail()) {
      console.warn('No ticker or asset detail available');
      return;
    }

    const assetDetail = this.assetDetail()!;
    
    // Create token data for the send form
    const tokenData = {
      name: assetDetail.name,
      symbol: assetDetail.symbol,
      address: this.ticker, // Use ticker as address
      balance: parseFloat(assetDetail.balance),
      usdPrice: 0.0,
      decimals: assetDetail.decimals
    };

    // Navigate directly to the send KRC20 form with token pre-selected
    this.flowPagesService.openFlow({
      id: 'send-krc20',
      title: `Send ${assetDetail.name}`,
      canNavigateBack: true,
      data: { token: tokenData }
    });
  }

  // Override formatTransactionAmount to properly convert from sompi
  protected override formatTransactionAmount(transaction: AssetTransaction): string {
    if (!transaction.amount) return '0';
    
    const amountInSompi = BigInt(transaction.amount);
    const amountNumber = this.kaspaNetworkActionsService.sompiToNumber(amountInSompi);
    const sign = transaction.type === 'transfer' && transaction.from === this.getCurrentWalletAddress() ? '-' : '+';
    
    return `${sign}${amountNumber.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 8 
    })}`;
  }

  // Helper method to determine if transaction amount is positive or negative
  protected isTransactionPositive(transaction: AssetTransaction): boolean {
    return !(transaction.type === 'transfer' && transaction.from === this.getCurrentWalletAddress());
  }

  // Override the goBack method to navigate properly
  protected override goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'krc20' } });
  }

  // Navigate to transaction details page
  navigateToTransactionDetails(transaction: AssetTransaction): void {
    if (!this.ticker) {
      console.warn('No ticker available for navigation');
      return;
    }
    
    this.router.navigate(['/app/home/asset/krc20', this.ticker, 'transaction', transaction.id]);
  }

  // Open transaction in explorer
  protected openTransactionInExplorer(transaction: AssetTransaction, event?: Event): void {
    // Prevent the card click event from firing
    if (event) {
      event.stopPropagation();
    }
    
    if (!transaction.id) return;
    
    const explorerUrl = `${environment.kaspaExplorerBaseurl}/txs/${transaction.id}`;
    window.open(explorerUrl, '_blank');
  }
} 