import { Component, ViewChild, computed, effect, inject, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { KnsDomainAsset } from '../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { KnsListService } from '../../../../../../../../services/assets-manager/kns-list.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';

@Component({
  selector: 'app-kns-summary',
  imports: [TitleCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './kns-summary.component.html',
  styleUrl: './kns-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class KnsSummaryComponent implements OnInit {
  // Services - portfolio pattern
  knsListService = inject(KnsListService);
  private router = inject(Router);
  private pendingThresholdReset = false;
  private _infiniteScrollDirective?: InfiniteScrollDirective;
  
  // Configuration
  readonly config = L1_PAGINATION_CONFIG.kns;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  private static readonly SKELETON_COUNT = 6;
  loadingSkeletons: unknown[] = Array.from({ length: KnsSummaryComponent.SKELETON_COUNT }).map(() => ({}));
  
  // Reference to infinite scroll directive
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

  constructor() {
    // Watch for data growth from auto-reload merge and reset scroll threshold
    effect(() => {
      const shouldCheck = this.knsListService.shouldCheckScrollPosition();
      if (!shouldCheck) {
        return;
      }

      if (this.infiniteScrollDirective) {
        this.infiniteScrollDirective.resetThreshold();
        this.pendingThresholdReset = false;
      } else {
        this.pendingThresholdReset = true;
      }
    }, { allowSignalWrites: true });
  }

  // Data from service - portfolio pattern
  domains = computed(() => this.knsListService.domains());
  
  // Loading states - portfolio pattern
  loading = computed(() => 
    !this.knsListService.initialLoadComplete() ||
    (this.domains().length === 0 && this.knsListService.isLoading())
  );
  
  isLoadingMore = computed(() => this.knsListService.isLoading());
  
  hasMore = computed(() => this.knsListService.hasMore());

  ngOnInit(): void {
    // Reset pagination state on component mount
    // This ensures clean state when switching tabs (component destroyed/recreated)
    // But list service persists as singleton, so we manually reset
    this.knsListService.reset();
  }

  /**
   * Called when scroll threshold is reached
   * Simple scroll-based pagination
   */
  shouldLoadMore(loadMore: boolean): void {
    if (loadMore && !this.knsListService.isFetching() && this.hasMore()) {
      this.knsListService.loadMore();
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByDomain(index: number, domain: any): string {
    return domain.assetId;
  }

  // Navigate to KNS domain detail page
  onDomainClick(domain: KnsDomainAsset): void {
    this.router.navigate(['/app/home/asset/kns', domain.assetId]);
  }
} 