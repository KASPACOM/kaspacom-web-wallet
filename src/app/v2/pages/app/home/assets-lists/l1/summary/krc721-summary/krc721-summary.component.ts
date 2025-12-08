import { Component, ViewChild, computed, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, DestroyRef } from '@angular/core';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { INftWithMetadata } from '../../../../../common/interfaces/nft.interface';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { Krc721MetadataService } from '../../../../../../../../services/asset-metadata/krc721-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { Krc721ListService } from '../../../../../../../../services/assets-manager/krc721-list.service';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-krc721-summary',
  imports: [TitleCasePipe, UpperCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './krc721-summary.component.html',
  styleUrl: './krc721-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc721SummaryComponent implements OnInit, AfterViewInit, OnDestroy {
  // Services - portfolio pattern
  krc721ListService = inject(Krc721ListService);
  private krc721MetadataService = inject(Krc721MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private metadataInitialized = false;
  private pendingThresholdReset = false;
  private _infiniteScrollDirective?: InfiniteScrollDirective;
  
  // Reference to the infinite scroll directive
  @ViewChild(InfiniteScrollDirective)
  set infiniteScrollDirective(directive: InfiniteScrollDirective | undefined) {
    this._infiniteScrollDirective = directive;

    if (directive && this.pendingThresholdReset) {
      directive.resetThreshold();
      this.pendingThresholdReset = false;
    }
  }

  get infiniteScrollDirective(): InfiniteScrollDirective | undefined {
    return this._infiniteScrollDirective;
  }
  
  // Configuration
  readonly config = L1_PAGINATION_CONFIG.krc721;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  private static readonly SKELETON_COUNT = 8;
  loadingSkeletons: unknown[] = Array.from({ length: Krc721SummaryComponent.SKELETON_COUNT }).map(() => ({}));
  
  constructor() {
    toObservable(this.krc721ListService.nfts)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(nfts => {
        if (!nfts || nfts.length === 0) {
          if (this.metadataInitialized) {
            this.krc721MetadataService.reset();
          }
          this.metadataInitialized = false;
          return;
        }

        if (!this.metadataInitialized) {
          this.krc721MetadataService.initialize(nfts);
          this.metadataInitialized = true;
          return;
        }

        this.krc721MetadataService.updateAssets(nfts);
      });

    toObservable(this.krc721ListService.shouldCheckScrollPosition)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(shouldReset => {
        if (!shouldReset) {
          return;
        }

        if (this.infiniteScrollDirective) {
          this.infiniteScrollDirective.resetThreshold();
          this.pendingThresholdReset = false;
        } else {
          this.pendingThresholdReset = true;
        }
      });
  }

  // Data from service - portfolio pattern
  nfts = computed<INftWithMetadata[]>(() => {
    const rawNfts = this.krc721ListService.nfts();
    const paginatedMetadata = this.krc721MetadataService.paginatedAssets();

    const metadataById = new Map<string, typeof paginatedMetadata[number]>();
    paginatedMetadata.forEach(item => {
      const assetId = `${item.data.tick}-${item.data.tokenId}`;
      metadataById.set(assetId, item);
    });
    
    // Merge NFT data with metadata
    return rawNfts.map(nft => {
      const metadataItem = metadataById.get(`${nft.tick}-${nft.tokenId}`);
      
      const metadata = metadataItem?.metadata || nft.metadata;
      
      return {
        tick: nft.tick,
        tokenId: nft.tokenId,
        owner: nft.owner,
        name: metadata?.name,
        description: metadata?.description,
        attributes: metadata?.attributes,
        image: metadata?.image,
        isLoadingMetadata: metadataItem?.isLoadingMetadata || false,
        rarityRank: nft.rarityRank,
        legendary: nft.legendary,
        totalSupply: nft.totalSupply
      };
    });
  });
  
  // Loading states - portfolio pattern
  loading = computed(() => {
    if (this.nfts().length > 0) {
      return false;
    }

    return (
      !this.krc721ListService.initialLoadComplete() ||
      this.krc721ListService.isLoading()
    );
  });
  
  isLoadingMore = computed(() => this.krc721ListService.isLoading());
  
  hasMore = computed(() => this.krc721ListService.hasMore());

  ngOnInit(): void {
    // Reset pagination state on component mount
    // This ensures clean state when switching tabs (component destroyed/recreated)
    // But list service persists as singleton, so we manually reset
    this.krc721ListService.reset();
    this.krc721MetadataService.reset();
  }

  ngAfterViewInit(): void {
    if (this.config.greedyLoading) {
      setTimeout(() => this.infiniteScrollDirective?.checkScroll(), 100);
    }
  }

  onScrolled(percentage: number): void {
    // Track scroll for metadata loading
    this.krc721MetadataService.onScroll(percentage);
    // Load metadata for newly visible items
    this.loadVisibleMetadata();
  }

  /**
   * Called when scroll threshold is reached
   * Simple scroll-based pagination
   */
  shouldLoadMore(loadMore: boolean): void {
    if (loadMore && !this.krc721ListService.isFetching() && this.hasMore()) {
      this.krc721ListService.loadMore();
    }
  }

  ngOnDestroy(): void {
    this.metadataInitialized = false;
    this.pendingThresholdReset = false;
    this.krc721MetadataService.reset();
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

  getRarityClass(nft: INftWithMetadata): string {
    if (nft.legendary || (nft.rarityRank !== undefined && nft.rarityRank < 0)) {
      return 'legendary';
    }
    
    if (nft.rarityRank !== undefined && nft.totalSupply) {
      const percentage = nft.rarityRank / nft.totalSupply;
      if (percentage <= 0.01) return 'gold';
      if (percentage <= 0.1) return 'silver';
      if (percentage <= 0.3) return 'bronze';
    }
    
    return 'neutral';
  }
} 