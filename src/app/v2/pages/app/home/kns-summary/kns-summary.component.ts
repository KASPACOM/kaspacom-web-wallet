import { Component, computed, inject } from '@angular/core';
import { TitleCasePipe, UpperCasePipe, DatePipe } from '@angular/common';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { AssetsStoreService } from '../../../../../services/assets-store.service';

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
  private assetsStore = inject(AssetsStoreService);

  // Use domains directly from assets store
  domains = computed(() => this.assetsStore.knsAssets());
  loading = computed(() => this.assetsStore.isAssetTypeLoading('kns'));

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
} 