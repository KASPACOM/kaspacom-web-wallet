import { Component, computed, inject, OnInit, OnDestroy, ViewChild, AfterViewInit, Injector } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { TokenLogoComponent } from '../../../../../common/token-logo/token-logo.component';
import { IToken, ITokenWithMetadata } from '../../../../../common/interfaces/token.interface';
import { SkeletonComponent } from "../../../../../../../shared/ui/skeleton";
import { AssetsStoreService } from '../../../../../../../../services/assets-store.service';
import { Krc20MetadataService } from '../../../../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, Observable } from 'rxjs';
import { GetTokenListDto } from '../../../../../../../../services/kasplex-api/dtos/token-list-info.dto';
import { runInInjectionContext } from '@angular/core';

@Component({
  selector: 'app-send-krc20-list',
  standalone: true,
  imports: [CommonModule, TokenLogoComponent, SkeletonComponent, DecimalPipe, TitleCasePipe, UpperCasePipe, InfiniteScrollDirective],
  templateUrl: './send-krc20-list.component.html',
  styleUrl: './send-krc20-list.component.scss'
})
export class SendKrc20ListComponent extends FlowPageBaseComponent implements OnInit, OnDestroy, AfterViewInit {
  private assetsStore = inject(AssetsStoreService);
  private krc20MetadataService = inject(Krc20MetadataService);
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

  get config(): IFlowPageConfig {
    return {
      id: 'send-krc20-list',
      title: 'Select KRC20 Token',
      canNavigateBack: true
    };
  }

  override ngOnInit() {
    super.ngOnInit();
    
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

  override ngOnDestroy(): void {
    super.ngOnDestroy();
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
    // Navigate to send token page with selected token
    this.navigateToNextPage({
      id: 'send-krc20',
      title: `Send ${token.name}`,
      canNavigateBack: true,
      data: { token }
    });
  }
}
