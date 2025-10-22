import { Component, computed, inject } from '@angular/core';
import { TitleCasePipe, UpperCasePipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { KnsDomainAsset } from '../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';

@Component({
  selector: 'app-kns-summary',
  imports: [TitleCasePipe, UpperCasePipe, DatePipe, SkeletonComponent],
  templateUrl: './kns-summary.component.html',
  styleUrl: './kns-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class KnsSummaryComponent {
  private assetsManagerService = inject(AssetsManagerService);
  private router = inject(Router);

  // Use domains directly from assets store
  domains = computed(() => this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.kns)() || []);
  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.kns)());

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByDomain(index: number, domain: any): string {
    return domain.assetId;
  }

  // Navigate to KNS domain detail page
  onDomainClick(domain: KnsDomainAsset): void {
    this.router.navigate(['/app/home/asset/kns', domain.assetId]);
  }
} 