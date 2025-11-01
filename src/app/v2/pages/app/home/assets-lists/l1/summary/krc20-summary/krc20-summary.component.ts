import {
  Component,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Krc20AssetCardComponent } from '../../asset-card/krc20-asset-card/krc20-asset-card.component';
import {
  ITokenWithMetadata,
} from '../../../../../common/interfaces/token.interface';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { Krc20MetadataService } from '../../../../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { Subject, takeUntil } from 'rxjs';
import { Krc20ListService } from '../../../../../../../../services/assets-manager/krc20-list.service';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';
import { KaspaPriceService } from '../../../../../../../../services/kaspa-price.service';

@Component({
  selector: 'app-krc20-summary',
  imports: [SkeletonComponent, InfiniteScrollDirective, Krc20AssetCardComponent, DecimalPipe],
  templateUrl: './krc20-summary.component.html',
  styleUrl: './krc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc20SummaryComponent
  implements OnInit, OnDestroy
{
  // Services - portfolio pattern
  krc20ListService = inject(Krc20ListService);
  private krc20MetadataService = inject(Krc20MetadataService);
  private kaspaPriceService = inject(KaspaPriceService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private destroy$ = new Subject<void>();
  
  // Configuration
  private readonly config = L1_PAGINATION_CONFIG.krc20;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  loadingSkeletons: unknown[] = Array.from({ length: 8 }).map(() => ({}));

  // Data from service - portfolio pattern
  tokens = computed<ITokenWithMetadata[]>(() => {
    const rawTokens = this.krc20ListService.tokens();
    const paginatedMetadata = this.krc20MetadataService.paginatedAssets();

    // Create a map of metadata by tick
    const metadataMap = new Map();
    paginatedMetadata.forEach((item) => {
      metadataMap.set(item.data.tick, {
        metadata: item.metadata,
        isLoadingMetadata: item.isLoadingMetadata,
      });
    });

    return rawTokens
      .map((token) => ({
        name: token.tick,
        symbol: token.tick.toUpperCase(),
        address: token.tick,
        balance: token.balance,
        priceKas: token.priceKas,
        isLoadingMetadata: metadataMap.get(token.tick)?.isLoadingMetadata || false,
      }))
      .sort((a, b) => (b.priceKas * b.balance) - (a.priceKas * a.balance));
  });

  // Loading states - portfolio pattern
  loading = computed(() => 
    !this.krc20ListService.initialLoadComplete() ||
    (this.tokens().length === 0 && this.krc20ListService.isLoading())
  );

  isLoadingMore = computed(() => 
    this.krc20MetadataService.isLoading() &&
    this.krc20MetadataService.paginatedAssets().length > 0
  );
  
  hasMore = computed(() => this.krc20MetadataService.hasMoreItems());

  ngOnInit(): void {
    // Reset pagination state on component mount
    // This ensures clean state when switching tabs (component destroyed/recreated)
    // But list service persists as singleton, so we manually reset
    this.krc20ListService.reset();
    
    // Initialize metadata service with token data
    // Watch for changes in token data and update metadata service
    const tokensEffect = computed(() => this.krc20ListService.tokens());
    
    // Manual subscription to computed signal changes
    let previousTokens = tokensEffect();
    this.krc20MetadataService.initialize(previousTokens);
    
    // Poll for changes (simple approach)
    const interval = setInterval(() => {
      const currentTokens = tokensEffect();
      if (currentTokens !== previousTokens) {
        previousTokens = currentTokens;
        this.krc20MetadataService.initialize(currentTokens);
      }
    }, 100);
    
    this.destroy$.pipe(takeUntil(this.destroy$)).subscribe({
      complete: () => clearInterval(interval)
    });
  }

  onScrolled(percentage: number): void {
    // Track scroll for metadata loading
    this.krc20MetadataService.onScroll(percentage);
    // Load metadata for newly visible items
    this.loadVisibleMetadata();
  }

  /**
   * Called when scroll threshold is reached
   * Simple scroll-based pagination
   */
  shouldLoadMore(loadMore: boolean): void {
    if (loadMore && !this.krc20ListService.isFetching() && this.hasMore()) {
      this.krc20ListService.loadMore();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTokenClick(token: ITokenWithMetadata): void {
    // Navigate to the KRC20 asset detail page
    this.router.navigate(['/app/home/asset/krc20', token.address]);
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByToken(index: number, token: ITokenWithMetadata): string {
    return token.address;
  }

  /**
   * Get item elements for viewport detection
   */
  private getItemElements(): HTMLElement[] {
    const container = this.elementRef.nativeElement;
    return Array.from(
      container.querySelectorAll('.wallet-summary-container__card'),
    );
  }

  /**
   * Load metadata for visible items
   */
  loadVisibleMetadata(): void {
    const itemElements = this.getItemElements();
    this.krc20MetadataService.loadMetadataForVisibleItems(itemElements);
  }

  totalValueKas(): number {
    return this.tokens().reduce((acc, token) => acc + token.priceKas * token.balance, 0);
  }

  totalValueUsd(): number {
    return this.totalValueKas() * this.kaspaPriceService.price();
  }
}
