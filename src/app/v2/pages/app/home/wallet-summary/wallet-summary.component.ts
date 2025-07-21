import { Component, computed, inject, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef, Injector } from '@angular/core';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TokenLogoComponent } from '../../common/token-logo/token-logo.component';
import { IToken, ITokenWithMetadata } from '../../common/interfaces/token.interface';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { AssetsStoreService } from '../../../../../services/assets-store.service';
import { Krc20MetadataService } from '../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../directives/infinite-scroll.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, Observable } from 'rxjs';
import { GetTokenListDto } from '../../../../../services/kasplex-api/dtos/token-list-info.dto';
import { runInInjectionContext } from '@angular/core';

@Component({
  selector: 'app-wallet-summary',
  imports: [TokenLogoComponent, DecimalPipe, UpperCasePipe, TitleCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './wallet-summary.component.html',
  styleUrl: './wallet-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class WalletSummaryComponent implements OnInit, OnDestroy, AfterViewInit {
  private assetsStore = inject(AssetsStoreService);
  private krc20MetadataService = inject(Krc20MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();
  private krc20Assets$!: Observable<GetTokenListDto[]>;

  @ViewChild(InfiniteScrollDirective) infiniteScroll!: InfiniteScrollDirective;

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<ITokenWithMetadata[]>(() => {
    const krc20Assets = this.assetsStore.krc20Assets();
    const paginatedAssets = this.krc20MetadataService.paginatedAssets();
    
    // Create a map of metadata by tick
    const metadataMap = new Map();
    paginatedAssets.forEach(item => {
      metadataMap.set(item.data.tick, {
        metadata: item.metadata,
        isLoadingMetadata: item.isLoadingMetadata
      });
    });
    
    return krc20Assets.map(token => {
      const metadataInfo = metadataMap.get(token.tick);
      
      return {
        name: token.tick,
        symbol: token.tick.toUpperCase(),
        address: token.tick,
        balance: token.balance,
        usdPrice: 0.0, // TODO: Add price data when available
        isLoadingMetadata: metadataInfo?.isLoadingMetadata || false
      };
    });
  });
  
  loading = computed(() => this.assetsStore.isAssetTypeLoading('krc20'));
  
  isLoadingMore = computed(() => 
    this.krc20MetadataService.isLoading() && 
    this.krc20MetadataService.paginatedAssets().length > 0
  );

  hasMore = computed(() => this.krc20MetadataService.hasMoreItems());

  ngOnInit(): void {
    // Create observable within injection context to ensure proper signal binding
    this.krc20Assets$ = runInInjectionContext(this.injector, () => 
      toObservable(this.assetsStore.krc20Assets)
    );
    
    // Initialize metadata service when assets are available, but don't block display
    this.krc20Assets$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      if (assets.length > 0) {
        // Only initialize if metadata service doesn't have any assets yet
        const currentPaginatedAssets = this.krc20MetadataService.paginatedAssets();
        if (currentPaginatedAssets.length === 0) {
          // Initialize metadata service in background
          setTimeout(() => {
            this.krc20MetadataService.initialize(assets);
          }, 100);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    // Check initial scroll position after view init
    setTimeout(() => {
      if (this.infiniteScroll) {
        this.infiniteScroll.checkScroll();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onScrolled(percentage: number): void {
    this.krc20MetadataService.onScroll(percentage);
  }

  onThresholdReached(): void {
    this.krc20MetadataService.loadMore();
  }

  onTokenClick(token: ITokenWithMetadata): void {
    // Navigate to the KRC20 asset detail page
    this.router.navigate(['/app/home/asset/krc20', token.address]);
  }

  /**
   * Get item elements for viewport detection
   */
  private getItemElements(): HTMLElement[] {
    const container = this.elementRef.nativeElement;
    return Array.from(container.querySelectorAll('.wallet-summary-container__card'));
  }

  /**
   * Load metadata for visible items
   */
  loadVisibleMetadata(): void {
    const itemElements = this.getItemElements();
    this.krc20MetadataService.loadMetadataForVisibleItems(itemElements);
  }
}
