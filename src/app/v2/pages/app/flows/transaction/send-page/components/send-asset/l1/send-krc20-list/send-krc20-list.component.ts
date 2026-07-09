import { Component, computed, inject, OnInit, OnDestroy, AfterViewInit, Injector, viewChild } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { ITokenWithMetadata } from '../../../../../../../common/interfaces/token.interface';
import { SkeletonComponent } from "../../../../../../../../../shared/ui/skeleton";
import { Krc20MetadataService } from '../../../../../../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../../../directives/infinite-scroll.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, Observable } from 'rxjs';
import { GetTokenListDto } from '../../../../../../../../../../services/kasplex-api/dtos/token-list-info.dto';
import { runInInjectionContext } from '@angular/core';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { Krc20TokenLogoComponent } from '../../../../../../../home/assets-lists/l1/logo/krc20-token-logo/krc20-token-logo.component';

@Component({
  selector: 'app-send-krc20-list',
  standalone: true,
  imports: [CommonModule, Krc20TokenLogoComponent, SkeletonComponent, DecimalPipe, TitleCasePipe, UpperCasePipe, InfiniteScrollDirective],
  templateUrl: './send-krc20-list.component.html',
  styleUrl: './send-krc20-list.component.scss'
})
export class SendKrc20ListComponent extends FlowPageBaseComponent implements OnInit, OnDestroy, AfterViewInit {
  private krc20MetadataService = inject(Krc20MetadataService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();
  private krc20Assets$!: Observable<GetTokenListDto[] | undefined>;
  private assetsManagerService = inject(AssetsManagerService);

  readonly infiniteScroll = viewChild.required(InfiniteScrollDirective);

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<ITokenWithMetadata[]>(() => {
    const krc20Assets = this.assetsManagerService.getAllAssetStores().l1.getAssets(L1_ASSET_KEYS.krc20);
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
        priceKas: token.priceKas,
        isLoadingMetadata: metadataInfo?.isLoadingMetadata || false
      };
    });
  });
  
  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc20)());
  
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
      toObservable(this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc20))
    );
    
    // Initialize metadata service when assets are available, but don't block display
    this.krc20Assets$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      if (assets && assets.length > 0) {
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
      const infiniteScroll = this.infiniteScroll();
      if (infiniteScroll) {
        infiniteScroll.checkScroll();
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
