import { Component, computed, effect, inject, OnInit, OnDestroy, viewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { KnsDomainAsset } from '../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { KnsListService } from '../../../../../../../../services/assets-manager/kns-list.service';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { L1_PAGINATION_CONFIG } from '../../../../../../../../services/assets-manager/interfaces/pagination-state.interface';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-kns-summary',
  imports: [TitleCasePipe, SkeletonComponent, InfiniteScrollDirective],
  templateUrl: './kns-summary.component.html',
  styleUrl: './kns-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class KnsSummaryComponent implements OnInit, OnDestroy {
  // Services - portfolio pattern
  knsListService = inject(KnsListService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  
  // Configuration
  private readonly config = L1_PAGINATION_CONFIG.kns;
  
  // Loading skeletons - portfolio pattern with opacity cascade
  loadingSkeletons: unknown[] = Array.from({ length: 6 }).map(() => ({}));
  
  // Reference to infinite scroll directive
  private infiniteScrollDirective = viewChild(InfiniteScrollDirective);

  constructor() {
    // Watch for data growth from auto-reload merge and reset scroll threshold
    effect(() => {
      const shouldCheck = this.knsListService.shouldCheckScrollPosition();
      if (shouldCheck && this.infiniteScrollDirective()) {
        this.infiniteScrollDirective()?.resetThreshold();
      }
    });
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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