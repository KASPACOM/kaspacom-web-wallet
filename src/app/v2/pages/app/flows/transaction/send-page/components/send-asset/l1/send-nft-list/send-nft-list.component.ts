import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  runInInjectionContext,
  viewChild,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, takeUntil } from 'rxjs';
import { InfiniteScrollDirective } from '../../../../../../../../../../directives/infinite-scroll.directive';
import { Krc721MetadataService } from '../../../../../../../../../../services/asset-metadata/krc721-metadata.service';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { Krc721Nft } from '../../../../../../../../../../services/krc721-api/dtos/krc721-nft.dto';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { INftWithMetadata } from '../../../../../../../common/interfaces/nft.interface';

@Component({
  selector: 'app-send-nft-list',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './send-nft-list.component.html',
  styleUrl: './send-nft-list.component.scss',
})
export class SendNftListComponent
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private krc721MetadataService = inject(Krc721MetadataService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();
  private krc721Assets$!: Observable<Krc721Nft[] | undefined>;
  private assetsManagerService = inject(AssetsManagerService);

  readonly infiniteScroll = viewChild.required(InfiniteScrollDirective);

  // Use NFTs from metadata service with pagination
  nfts = computed<INftWithMetadata[]>(() => {
    const paginatedAssets = this.krc721MetadataService.paginatedAssets();
    return paginatedAssets.map((item) => {
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
        isListed: nft.isListed,
        isLoadingMetadata: item.isLoadingMetadata,
      };
    });
  });

  loading = computed(
    () =>
      !this.assetsManagerService
        .getAllAssetStores()
        .l1.getAssetSignal(L1_ASSET_KEYS.krc721)() ||
      (this.krc721MetadataService.paginatedAssets().length === 0 &&
        this.krc721MetadataService.isLoading()),
  );

  isLoadingMore = computed(
    () =>
      this.krc721MetadataService.isLoading() &&
      this.krc721MetadataService.paginatedAssets().length > 0,
  );

  hasMore = computed(() => this.krc721MetadataService.hasMoreItems());

  get config(): IFlowPageConfig {
    return {
      id: 'send-nft-list',
      title: 'Select NFT',
      canNavigateBack: true,
    };
  }

  override ngOnInit() {
    super.ngOnInit();

    // Create observable within injection context to ensure proper signal binding
    this.krc721Assets$ = runInInjectionContext(this.injector, () =>
      toObservable(
        this.assetsManagerService
          .getAllAssetStores()
          .l1.getAssetSignal(L1_ASSET_KEYS.krc721),
      ),
    );

    // Subscribe to assets store changes and reinitialize metadata service
    // IMPORTANT: Always reinitialize to handle wallet account changes properly
    this.krc721Assets$.pipe(takeUntil(this.destroy$)).subscribe((assets) => {
      // Always initialize to ensure metadata service is reset on wallet changes
      this.krc721MetadataService.initialize(assets);
    });
  }

  ngAfterViewInit(): void {
    // Check initial scroll position after view init
    setTimeout(() => {
      const infiniteScroll = this.infiniteScroll();
      if (infiniteScroll) {
        infiniteScroll.checkScroll();
      }
      // Also load metadata for initially visible items
      this.loadVisibleMetadata();
    }, 100);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
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
    if (this.isListed(nft)) {
      return;
    }

    // Navigate to send nft page with selected nft
    this.navigateToNextPage({
      id: 'send-nft',
      title: `Send ${this.getDisplayName(nft)}`,
      canNavigateBack: true,
      data: { nft },
    });
  }

  // Helper method to get display name
  getDisplayName(nft: INftWithMetadata): string {
    return this.krc721MetadataService.getDisplayName(nft, nft as any);
  }

  // Helper method to get image URL
  getImageUrl(nft: INftWithMetadata): string {
    return this.krc721MetadataService.getImageUrl(nft, nft as any);
  }

  isListed(nft: INftWithMetadata): boolean {
    return nft.isListed === true;
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8c3ZnIHg9IjEyIiB5PSIxMiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz4KPGR5bGluZSB4MT0iMjEiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iNiIvPgo8L3N2Zz4KPC9zdmc+';
    }
  }

  /**
   * Load metadata for visible items
   */
  private loadVisibleMetadata(): void {
    const itemElements = Array.from(
      document.querySelectorAll('.nft-list-card'),
    ) as HTMLElement[];
    this.krc721MetadataService.loadMetadataForVisibleItems(itemElements);
  }
}
