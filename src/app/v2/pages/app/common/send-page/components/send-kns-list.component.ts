import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton.component';
import { KnsApiService } from '../../../../../../services/kns-api/kns-api.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { KnsDomainAsset } from '../../../../../../services/kns-api/dtos/kns-domain.dto';

@Component({
  selector: 'app-send-kns-list',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, DatePipe],
  templateUrl: './send-kns-list.component.html',
  styleUrl: './send-kns-list.component.scss'
})
export class SendKnsListComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private knsService = inject(KnsApiService);
  
  domains = signal<KnsDomainAsset[]>([]);
  loading = signal<boolean>(true);

  get config(): IFlowPageConfig {
    return {
      id: 'send-kns-list',
      title: 'Select KNS Domain',
      canNavigateBack: true
    };
  }

  override async ngOnInit() {
    await this.loadDomains();
  }

  private async loadDomains() {
    try {
      this.loading.set(true);
      const currentWallet = this.walletService.getCurrentWallet();

      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      const domains = await this.knsService.getAllWalletDomains(currentWallet.getAddress());

      this.domains.set(domains);
    } catch (error) {
      console.error('Failed to load KNS domains:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onDomainClick(domain: KnsDomainAsset): void {
    this.navigateToNextPage({
      id: 'send-kns',
      title: `Send ${domain.asset}`,
      canNavigateBack: true,
      data: {
        assetId: domain.assetId,
        asset: domain.asset
      }
    });
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  getDomainType(domain: KnsDomainAsset): string {
    return domain.isDomain ? 'DOM' : 'TXT';
  }

  getDomainTypeLabel(domain: KnsDomainAsset): string {
    return domain.isDomain ? 'Domain' : 'Text Record';
  }
}