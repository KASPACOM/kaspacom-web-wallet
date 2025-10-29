import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { BaseAssetPageComponent, AssetDetail, AssetTransaction } from '../../../../../common/base-asset-page/base-asset-page.component';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPagesService } from '../../../../../../../services/flow-pages.service';
import { KcLabeledTabsComponent, TabItem } from '../../../../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { ERC20Contract } from '../../../../../../../../services/etherium-services/smart-contracts/contracts/erc20-contract';
import { formatUnits } from 'ethers';
import { WalletActionService } from '../../../../../../../../services/wallet-action.service';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L2AssetsStoreService } from '../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';

interface Erc20TokenInfo {
  balance: number;
  decimals: number;
  name: string;
  symbol: string;
  totalSupply: number;
  address: string;
}

@Component({
  selector: 'app-erc20-asset',
  imports: [
    CommonModule,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent,
    KcLabeledTabsComponent
  ],
  templateUrl: './erc20-asset.component.html',
  styleUrl: './erc20-asset.component.scss'
})
export class Erc20AssetComponent extends BaseAssetPageComponent implements OnInit {
  protected route = inject(ActivatedRoute);
  private flowPagesService = inject(FlowPagesService);
  private assetsManagerService = inject(AssetsManagerService); 

  address: string | null = null;

  // Tab management
  selectedTabId = signal<string>('token-info');
  tabs: TabItem[] = [
    { id: 'token-info', label: 'Token Info' }
  ];

  // Token metadata
  protected tokenInfo = signal<Erc20TokenInfo | null>(null);

  override ngOnInit() {
    this.address = this.route.snapshot.paramMap.get('address');
    this.loadAssetData();
  }

  // Tab change handler
  onTabChange(tabId: string) {
    this.selectedTabId.set(tabId);
  }

  // Helper method to format large numbers
  protected formatNumber(value: string | undefined): string {
    if (!value || value === '0') return '0';
    return parseInt(value).toLocaleString();
  }

  protected override async loadAssetData(): Promise<void> {
    if (!this.address) {
      this.loading.set(false);
      return;
    }

    try {
      this.loading.set(true);

      const contract = ERC20Contract.getContract(this.address, this.walletService);

      const [{balance, decimals, name, symbol}, totalSupply] = await Promise.all([
        (this.assetsManagerService.getAllAssetStores().l2 as L2AssetsStoreService).getErc20InfoFromBlockchain(this.address),
        contract.totalSupply(),
      ])

      this.assetDetail.set({
        name: name,
        symbol: symbol,
        balance: balance!.toString(),
        decimals: decimals,
      });

      this.tokenInfo.set({
        balance: balance!,
        decimals: decimals,
        name: name,
        symbol: symbol,
        totalSupply: parseFloat(formatUnits(totalSupply.toString(), decimals)),
        address: this.address,
      });

    } catch (error) {
      console.error('Failed to load eRC20 asset data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected override onSendAction(): void {
    if (!this.tokenInfo || !this.assetDetail()) {
      console.warn('No ticker or asset detail available');
      return;
    }

    const assetDetail = this.assetDetail()!;

    // Create token data for the send form
    const tokenData = {
      name: assetDetail.name,
      symbol: assetDetail.symbol,
      address: this.address, // Use ticker as address
      balance: parseFloat(assetDetail.balance),
      decimals: assetDetail.decimals
    };

    // Navigate directly to the send eRC20 form with token pre-selected
    this.flowPagesService.openFlow({
      id: 'send-erc20',
      title: `Send ${assetDetail.name}`,
      canNavigateBack: true,
      data: { token: tokenData }
    });
  }


  // Override the goBack method to navigate properly
  protected override goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'erc20' } });
  }


  protected shortBalance(): string {
    const detail = this.assetDetail();
    if (!detail) return '0';

    const balance = parseFloat(detail.balance);
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }
}
