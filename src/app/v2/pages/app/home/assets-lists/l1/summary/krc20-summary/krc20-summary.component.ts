import {
  Component,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  ElementRef,
  Injector,
} from '@angular/core';
import {} from '@angular/common';
import { Router } from '@angular/router';
import { Krc20AssetCardComponent } from '../../asset-card/krc20-asset-card/krc20-asset-card.component';
import {
  IToken,
  ITokenWithMetadata,
} from '../../../../../common/interfaces/token.interface';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { Krc20MetadataService } from '../../../../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, Observable } from 'rxjs';
import { GetTokenListDto } from '../../../../../../../../services/kasplex-api/dtos/token-list-info.dto';
import { runInInjectionContext } from '@angular/core';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';

@Component({
  selector: 'app-krc20-summary',
  imports: [SkeletonComponent, InfiniteScrollDirective, Krc20AssetCardComponent],
  templateUrl: './krc20-summary.component.html',
  styleUrl: './krc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc20SummaryComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private assetsManagerService = inject(AssetsManagerService);
  private krc20MetadataService = inject(Krc20MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();
  private krc20Assets$!: Observable<GetTokenListDto[] | undefined>;

  @ViewChild(InfiniteScrollDirective) infiniteScroll!: InfiniteScrollDirective;

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<ITokenWithMetadata[]>(() => {
    const krc20Assets = this.assetsManagerService.getAllAssetStores().l1.getAssets(
      L1_ASSET_KEYS.krc20,
    );
    const paginatedAssets = this.krc20MetadataService.paginatedAssets();

    // Create a map of metadata by tick
    const metadataMap = new Map();
    paginatedAssets.forEach((item) => {
      metadataMap.set(item.data.tick, {
        metadata: item.metadata,
        isLoadingMetadata: item.isLoadingMetadata,
      });
    });

    return krc20Assets
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

  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc20)());

  isLoadingMore = computed(
    () =>
      this.krc20MetadataService.isLoading() &&
      this.krc20MetadataService.paginatedAssets().length > 0,
  );

  hasMore = computed(() => this.krc20MetadataService.hasMoreItems());

  ngOnInit(): void {
    // Create observable within injection context to ensure proper signal binding
    this.krc20Assets$ = runInInjectionContext(this.injector, () =>
      toObservable(this.assetsManagerService.getAllAssetStores().l1.getAssetSignal(L1_ASSET_KEYS.krc20)),
    );

    // Subscribe to assets store changes and reinitialize metadata service
    // IMPORTANT: Always reinitialize, even with empty arrays, to clear stale data
    this.krc20Assets$.pipe(takeUntil(this.destroy$)).subscribe((assets) => {
      // Always initialize to ensure metadata service is reset on wallet changes
      // This fixes the sync bug where old account's tokens were shown after switching accounts
      setTimeout(() => {
        this.krc20MetadataService.initialize(assets);
      }, 100);
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
}
