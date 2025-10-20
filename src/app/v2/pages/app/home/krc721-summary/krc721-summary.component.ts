import { Component, computed, inject, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef, Injector } from '@angular/core';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { INftWithMetadata } from '../../common/interfaces/nft.interface';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { Krc721MetadataService } from '../../../../../services/asset-metadata/krc721-metadata.service';
import { InfiniteScrollDirective } from '../../../../../directives/infinite-scroll.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, Observable } from 'rxjs';
import { Krc721Nft } from '../../../../../services/krc721-api/dtos/krc721-nft.dto';
import { runInInjectionContext } from '@angular/core';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../services/assets-manager/assets-stores/l1-assets-store.service';

@Component({
  selector: 'app-krc721-summary',
  imports: [TitleCasePipe, UpperCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './krc721-summary.component.html',
  styleUrl: './krc721-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc721SummaryComponent implements OnInit, OnDestroy, AfterViewInit {
  private krc721MetadataService = inject(Krc721MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();
  private krc721Assets$!: Observable<Krc721Nft[] | undefined>;
  private assetsManagerService = inject(AssetsManagerService);

  @ViewChild(InfiniteScrollDirective) infiniteScroll!: InfiniteScrollDirective;

  // Use the nfts from metadata service with pagination
  nfts = computed<INftWithMetadata[]>(() => {
    const paginatedAssets = this.krc721MetadataService.paginatedAssets();
    return paginatedAssets.map(item => {
      const nft = item.data;
      const metadata = item.metadata || nft.metadata;
      return {
        tick: nft.tick,
        tokenId: nft.tokenId,
        owner: nft.owner,
        name: metadata?.name,
        description: metadata?.description,
        attributes: metadata?.attributes,
        image: metadata?.image,
        isLoadingMetadata: item.isLoadingMetadata
      };
    });
  });
  
  loading = computed(() => 
    !this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc721)() || 
    (this.krc721MetadataService.paginatedAssets().length === 0 && this.krc721MetadataService.isLoading())
  );
  
  isLoadingMore = computed(() => 
    this.krc721MetadataService.isLoading() && 
    this.krc721MetadataService.paginatedAssets().length > 0
  );

  hasMore = computed(() => this.krc721MetadataService.hasMoreItems());

  ngOnInit(): void {
    // Create observable within injection context to ensure proper signal binding
    this.krc721Assets$ = runInInjectionContext(this.injector, () => 
      toObservable(this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc721))
    );
    
    // Subscribe to assets store changes and reinitialize metadata service
    // IMPORTANT: Always reinitialize, even with empty arrays, to clear stale data
    this.krc721Assets$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      // Always initialize to ensure metadata service is reset on wallet changes
      // This fixes the sync bug where old account's NFTs were shown after switching accounts
      this.krc721MetadataService.initialize(assets);
    });
  }

  ngAfterViewInit(): void {
    // Check initial scroll position after view init
    setTimeout(() => {
      if (this.infiniteScroll) {
        this.infiniteScroll.checkScroll();
      }
      // Also load metadata for initially visible items
      this.loadVisibleMetadata();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onScrolled(percentage: number): void {
    this.krc721MetadataService.onScroll(percentage);
    // Load metadata for newly visible items
    this.loadVisibleMetadata();
  }

  onThresholdReached(): void {
    this.krc721MetadataService.loadMore();
  }

  onNftClick(nft: INftWithMetadata): void {
    // Navigate to the KRC721 asset detail page
    this.router.navigate(['/app/home/asset/krc721', nft.tick, nft.tokenId]);
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByNft(index: number, nft: INftWithMetadata): string {
    return `${nft.tick}-${nft.tokenId}`;
  }

  // Helper method to get display name
  getDisplayName(nft: INftWithMetadata): string {
    return this.krc721MetadataService.getDisplayName(nft, nft as any);
  }

  // Helper method to get image URL
  getImageUrl(nft: INftWithMetadata): string {
    return this.krc721MetadataService.getImageUrl(nft, nft as any);
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8c3ZnIHg9IjEyIiB5PSIxMiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz4KPGR5bGluZSB4MT0iMjEiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iNiIvPgo8L3N2Zz4KPC9zdmc+';
    }
  }

  /**
   * Get item elements for viewport detection
   */
  private getItemElements(): HTMLElement[] {
    const container = this.elementRef.nativeElement;
    return Array.from(container.querySelectorAll('.krc721-summary-container__card'));
  }

  /**
   * Load metadata for visible items
   */
  private loadVisibleMetadata(): void {
    const itemElements = this.getItemElements();
    this.krc721MetadataService.loadMetadataForVisibleItems(itemElements);
  }
} 