import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  KcButtonComponent,
  KcIconComponent,
  KcTooltipDirective,
} from 'kaspacom-ui';
import { BaseAssetPageComponent } from '../../../../../common/base-asset-page/base-asset-page.component';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPagesService } from '../../../../../../../services/flow-pages.service';
import { KnsApiService } from '../../../../../../../../services/kns-api/kns-api.service';
import {
  KnsDomainAsset,
  KnsWalletAssetsStatus,
} from '../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { CopyButtonComponent } from '../../../../../../../shared/ui/copy-button/copy-button.component';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { KaspaL1NetworkService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';

@Component({
  selector: 'app-kns-asset',
  imports: [
    CommonModule,
    KcButtonComponent,
    KcIconComponent,
    KcTooltipDirective,
    SkeletonComponent,
    CopyButtonComponent,
  ],
  templateUrl: './kns-asset.component.html',
  styleUrl: './kns-asset.component.scss',
})
export class KnsAssetComponent
  extends BaseAssetPageComponent
  implements OnInit
{
  private route = inject(ActivatedRoute);
  private knsService = inject(KnsApiService);
  private flowPagesService = inject(FlowPagesService);
  private assetsManagerService = inject(AssetsManagerService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private assetId: string = '';

  protected knsDetail = signal<KnsDomainAsset | null>(null);
  protected detailLoading = signal<boolean>(true);

  override async ngOnInit() {
    // Get the assetId from route params
    this.route.params.subscribe((params) => {
      this.assetId = params['assetId'];
      if (this.assetId) {
        super.ngOnInit();
        this.loadKnsDetails();
      }
    });
  }

  protected override async loadAssetData(): Promise<void> {
    if (!this.assetId) {
      this.loading.set(false);
      return;
    }

    try {
      this.loading.set(true);

      // First try to get the domain from the assets store
      const knsAssets = this.assetsManagerService
        .getAllAssetStores()
        .l1.getAssets(L1_ASSET_KEYS.kns);
      const storedDomain = knsAssets.find(
        (domain) => domain.assetId === this.assetId,
      );

      if (storedDomain) {
        // Use data from store
        const assetDetail = {
          name: storedDomain.asset,
          symbol: storedDomain.isDomain ? 'DOM' : 'TXT',
          balance: '1', // KNS domains always have a balance of 1
          decimals: 0,
        };
        this.assetDetail.set(assetDetail);
        this.knsDetail.set(storedDomain);
      } else {
        // Fallback to API if not in store
        const response = await firstValueFrom(
          this.knsService.fetchAssetByAssetId(this.assetId),
        );

        if (response.data) {
          const domain = response.data;
          const assetDetail = {
            name: domain.asset,
            symbol: domain.isDomain ? 'DOM' : 'TXT',
            balance: '1',
            decimals: 0,
          };
          this.assetDetail.set(assetDetail);
          this.knsDetail.set(domain);
        }
      }
    } catch (error) {
      console.error('Failed to load KNS asset data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadKnsDetails(): Promise<void> {
    if (!this.assetId) {
      this.detailLoading.set(false);
      return;
    }

    try {
      this.detailLoading.set(true);

      // Try to get from store first
      const knsAssets = this.assetsManagerService
        .getAllAssetStores()
        .l1.getAssets(L1_ASSET_KEYS.kns);
      const storedDomain = knsAssets.find(
        (domain) => domain.assetId === this.assetId,
      );

      if (storedDomain) {
        this.knsDetail.set(storedDomain);
      } else {
        // Fallback to API
        const response = await firstValueFrom(
          this.knsService.fetchAssetByAssetId(this.assetId),
        );
        if (response.data) {
          this.knsDetail.set(response.data);
        }
      }
    } catch (error) {
      console.error('Failed to load KNS domain details:', error);
    } finally {
      this.detailLoading.set(false);
    }
  }

  protected override async loadTransactionHistory(): Promise<void> {
    // KNS domains don't have traditional transaction history like KRC20 tokens
    // We could potentially load operation history here in the future
    this.historyLoading.set(false);
    this.transactions.set([]);
  }

  // Helper methods for template
  protected getDisplayName(): string {
    const detail = this.knsDetail();
    if (!detail) return 'Loading...';

    return detail.isDomain
      ? detail.asset.charAt(0).toUpperCase() + detail.asset.slice(1)
      : detail.asset;
  }

  protected getDomainTypeLabel(): string {
    const detail = this.knsDetail();
    return detail?.isDomain ? 'Domain' : 'Text Record';
  }

  protected getStatus(): string {
    const detail = this.knsDetail();
    return detail?.status || 'Unknown';
  }

  protected isVerified(): boolean {
    const detail = this.knsDetail();
    return detail?.isVerifiedDomain || false;
  }

  protected isListed(): boolean {
    return (
      this.knsDetail()?.status?.toLowerCase() === KnsWalletAssetsStatus.LISTED
    );
  }

  protected getTransferDisabledReason(): string {
    return this.isListed()
      ? 'Cancel the listing before sending this domain.'
      : '';
  }

  protected formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getOwnerAddress(): string {
    const detail = this.knsDetail();
    return detail?.owner || 'N/A';
  }

  protected getTransactionId(): string {
    const detail = this.knsDetail();
    return detail?.transactionId || 'N/A';
  }

  protected getMimeType(): string {
    const detail = this.knsDetail();
    return detail?.mimeType || 'N/A';
  }

  // Override send action for KNS domains
  protected override onSendAction(): void {
    const domain = this.knsDetail();
    if (domain && !this.isListed()) {
      this.flowPagesService.openFlow({
        id: 'send-kns',
        title: `Send ${domain.asset}`,
        canNavigateBack: true,
        data: { domain: domain },
      });
    }
  }

  // Open in explorer functionality
  protected openInExplorer(): void {
    const detail = this.knsDetail();
    if (!detail?.transactionId) return;

    const explorerUrl = `${this.kaspaL1NetworkService.getKaspaExplorerBaseurl()}/txs/${detail.transactionId}`;
    window.open(explorerUrl, '_blank');
  }

  // Override the goBack method to navigate properly
  protected override goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'kns' } });
  }
}
