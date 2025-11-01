import { Component, computed, inject, OnInit, OnDestroy, ElementRef, ViewChild, effect } from '@angular/core';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { INftWithMetadata } from '../../../../../common/interfaces/nft.interface';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { Krc721MetadataService } from '../../../../../../../../services/asset-metadata/krc721-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { Subject, takeUntil } from 'rxjs';
import { Krc721ListService } from '../../../../../../../../services/assets-manager/krc721-list.service';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';

@Component({
  selector: 'app-krc721-summary',
  imports: [TitleCasePipe, UpperCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './krc721-summary.component.html',
  styleUrl: './krc721-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc721SummaryComponent implements OnInit, OnDestroy {
  // Services - portfolio pattern
  krc721ListService = inject(Krc721ListService);
  private krc721MetadataService = inject(Krc721MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private destroy$ = new Subject<void>();
  
  // Reference to the infinite scroll directive
  @ViewChild(InfiniteScrollDirective) infiniteScrollDirective?: InfiniteScrollDirective;
  
  // Configuration
  private readonly config = L1_PAGINATION_CONFIG.krc721;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  loadingSkeletons: unknown[] = Array.from({ length: 8 }).map(() => ({}));
  
  constructor() {
    // Watch for data growing from auto-reload merge
    // Effect in constructor HAS injection context ✅
    effect(() => {
      const shouldCheck = this.krc721ListService.shouldCheckScrollPosition();
      if (shouldCheck && this.infiniteScrollDirective) {
        this.infiniteScrollDirective.resetThreshold();
      }
    });
  }

  // Data from service - portfolio pattern
  nfts = computed<INftWithMetadata[]>(() => {
    const rawNfts = this.krc721ListService.nfts();
    const paginatedMetadata = this.krc721MetadataService.paginatedAssets();
    
    // Merge NFT data with metadata
    return rawNfts.map(nft => {
      const metadataItem = paginatedMetadata.find(
        item => item.data.tick === nft.tick && item.data.tokenId === nft.tokenId
      );
      
      const metadata = metadataItem?.metadata || nft.metadata;
      
      return {
        tick: nft.tick,
        tokenId: nft.tokenId,
        owner: nft.owner,
        name: metadata?.name,
        description: metadata?.description,
        attributes: metadata?.attributes,
        image: metadata?.image,
        isLoadingMetadata: metadataItem?.isLoadingMetadata || false
      };
    });
  });
  
  // Loading states - portfolio pattern
  loading = computed(() => 
    !this.krc721ListService.initialLoadComplete() ||
    (this.nfts().length === 0 && this.krc721ListService.isLoading())
  );
  
  isLoadingMore = computed(() => this.krc721ListService.isLoading());
  
  hasMore = computed(() => this.krc721ListService.hasMore());

  ngOnInit(): void {
    // Reset pagination state on component mount
    // This ensures clean state when switching tabs (component destroyed/recreated)
    // But list service persists as singleton, so we manually reset
    this.krc721ListService.reset();
    
    // Initialize metadata service with NFT data
    // Watch for changes in NFT data and update metadata service
    const nftsEffect = computed(() => this.krc721ListService.nfts());
    
    // Subscribe to NFT changes and reinitialize metadata service
    // This ensures metadata stays in sync with loaded NFTs
    this.destroy$.pipe(takeUntil(this.destroy$)).subscribe();
    
    // Watch nfts signal and initialize metadata
    const subscription = {
      next: (nfts: unknown) => {
        this.krc721MetadataService.initialize(nfts as any);
      }
    };
    
    // Manual subscription to computed signal changes
    let previousNfts = nftsEffect();
    let previousLength = previousNfts?.length || 0;
    if (previousNfts && previousNfts.length > 0) {
      // Initial load: use initialize() to set up everything
      this.krc721MetadataService.initialize(previousNfts);
    }
    
    // Poll for changes (smart update - preserves cached metadata)
    // Uses updateAssets() instead of initialize() to keep cached metadata for existing NFTs
    const interval = setInterval(() => {
      const currentNfts = nftsEffect();
      const currentLength = currentNfts?.length || 0;
      
      // Check if list changed (length or reference)
      if (currentNfts !== previousNfts) {
        previousNfts = currentNfts;
        previousLength = currentLength;
        
        if (currentNfts && currentNfts.length > 0) {
          // Use updateAssets() to preserve cached metadata instead of initialize()
          this.krc721MetadataService.updateAssets(currentNfts as any);
        }
      }
    }, 100);
    
    this.destroy$.pipe(takeUntil(this.destroy$)).subscribe({
      complete: () => clearInterval(interval)
    });
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
    this.destroy$.next();
    this.destroy$.complete();
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