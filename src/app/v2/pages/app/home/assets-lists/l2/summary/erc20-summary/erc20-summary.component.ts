import {
  Component,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import {} from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { Krc20MetadataService } from '../../../../../../../../services/asset-metadata/krc20-metadata.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { Subject } from 'rxjs';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L2_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { Erc20AssetCardComponent } from '../asset-card/erc20-asset-card/erc20-asset-card.component';

@Component({
  selector: 'app-erc20-summary',
  imports: [SkeletonComponent, InfiniteScrollDirective, Erc20AssetCardComponent ],
  templateUrl: './erc20-summary.component.html',
  styleUrl: './erc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Erc20SummaryComponent
  implements OnDestroy, AfterViewInit
{
  private assetsManagerService = inject(AssetsManagerService);
  private krc20MetadataService = inject(Krc20MetadataService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private destroy$ = new Subject<void>();

  @ViewChild(InfiniteScrollDirective) infiniteScroll!: InfiniteScrollDirective;

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<Erc20Token[]>(() => {
    const erc20Assets: Erc20Token[] = this.assetsManagerService.getAllAssetStores().l2.getAssets(
      L2_ASSET_KEYS.erc20,
    );

    return erc20Assets;
  });

  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l2.getAssetSignal(L2_ASSET_KEYS.erc20)());

  isLoadingMore = computed(
    () =>
      this.krc20MetadataService.isLoading() &&
      this.krc20MetadataService.paginatedAssets().length > 0,
  );

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

  onTokenClick(token: Erc20Token): void {
    // Navigate to the KRC20 asset detail page
    this.router.navigate(['/app/home/asset/erc20', token.address]);
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByToken(index: number, token: Erc20Token): string {
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
