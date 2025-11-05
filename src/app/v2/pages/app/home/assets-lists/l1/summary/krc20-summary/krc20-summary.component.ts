import {
  Component,
  ViewChild,
  computed,
  inject,
  OnInit,
  AfterViewInit,
  ElementRef,
  DestroyRef,
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
import { Krc20ListService } from '../../../../../../../../services/assets-manager/krc20-list.service';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';
import { KaspaPriceService } from '../../../../../../../../services/kaspa-price.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-krc20-summary',
  imports: [SkeletonComponent, InfiniteScrollDirective, Krc20AssetCardComponent, DecimalPipe],
  templateUrl: './krc20-summary.component.html',
  styleUrl: './krc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc20SummaryComponent implements OnInit, AfterViewInit {
  // Services - portfolio pattern
  krc20ListService = inject(Krc20ListService);
  private krc20MetadataService = inject(Krc20MetadataService);
  private kaspaPriceService = inject(KaspaPriceService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private metadataInitialized = false;
  private pendingThresholdReset = false;
  private _infiniteScrollDirective?: InfiniteScrollDirective;

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
  readonly config = L1_PAGINATION_CONFIG.krc20;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  private static readonly SKELETON_COUNT = 8;
  loadingSkeletons: unknown[] = Array.from({ length: Krc20SummaryComponent.SKELETON_COUNT }).map(() => ({}));

  constructor() {
    toObservable(this.krc20ListService.tokens)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tokens => {
        if (!tokens || tokens.length === 0) {
          if (this.metadataInitialized) {
            this.krc20MetadataService.reset();
          }
          this.metadataInitialized = false;
          return;
        }

        if (!this.metadataInitialized) {
          this.krc20MetadataService.initialize(tokens);
          this.metadataInitialized = true;
          return;
        }

        this.krc20MetadataService.updateAssets(tokens);
      });

    toObservable(this.krc20ListService.shouldCheckScrollPosition)
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
    this.krc20MetadataService.reset();
  }

  ngAfterViewInit(): void {
    if (this.config.greedyLoading) {
      setTimeout(() => this.infiniteScrollDirective?.checkScroll(), 100);
    }
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
