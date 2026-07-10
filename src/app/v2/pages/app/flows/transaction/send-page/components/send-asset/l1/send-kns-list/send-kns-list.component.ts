import { Component, computed, inject } from '@angular/core';
import { KcTooltipDirective } from 'kaspacom-ui';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import {
  KnsDomainAsset,
  KnsWalletAssetsStatus,
} from '../../../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-kns-list',
  standalone: true,
  imports: [KcTooltipDirective, SkeletonComponent],
  templateUrl: './send-kns-list.component.html',
  styleUrl: './send-kns-list.component.scss',
})
export class SendKnsListComponent extends FlowPageBaseComponent {
  private assetsManager = inject(AssetsManagerService);

  // Use KNS domains directly from assets store
  domains = computed(
    () =>
      this.assetsManager
        .getAllAssetStores()
        .l1.getAssetSignal(L1_ASSET_KEYS.kns)() || [],
  );
  loading = computed(
    () =>
      !this.assetsManager
        .getAllAssetStores()
        .l1.getAssetSignal(L1_ASSET_KEYS.kns)(),
  );

  get config(): IFlowPageConfig {
    return {
      id: 'send-kns-list',
      title: 'Select KNS Domain',
      canNavigateBack: true,
    };
  }

  override ngOnInit() {
    // No need to load data as it's already in the assets store
  }

  onDomainClick(domain: KnsDomainAsset): void {
    if (this.isListed(domain)) {
      return;
    }

    // Navigate to send KNS page with selected domain
    this.navigateToNextPage({
      id: 'send-kns',
      title: `Send ${domain.asset}`,
      canNavigateBack: true,
      data: { domain },
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getDomainType(domain: KnsDomainAsset): string {
    return domain.isDomain ? 'DOM' : 'TXT';
  }

  getDomainTypeLabel(domain: KnsDomainAsset): string {
    return domain.isDomain ? 'Domain' : 'Text Record';
  }

  isListed(domain: KnsDomainAsset): boolean {
    return domain.status?.toLowerCase() === KnsWalletAssetsStatus.LISTED;
  }

  getTransferDisabledReason(domain: KnsDomainAsset): string {
    return this.isListed(domain)
      ? 'Cancel the listing before sending this domain.'
      : '';
  }
}
