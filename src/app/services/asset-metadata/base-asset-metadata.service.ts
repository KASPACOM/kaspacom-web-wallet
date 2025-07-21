import { Injectable, signal, WritableSignal, computed, Signal } from '@angular/core';
import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged } from 'rxjs';

export interface PaginatedAsset<T> {
  data: T;
  metadata?: any;
  isLoadingMetadata?: boolean;
  metadataError?: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;
}

@Injectable()
export abstract class BaseAssetMetadataService<TAsset, TMetadata> {
  // Signals for reactive state
  protected paginatedAssetsSignal: WritableSignal<PaginatedAsset<TAsset>[]> = signal([]);
  protected paginationStateSignal: WritableSignal<PaginationState> = signal({
    currentPage: 0,
    pageSize: 20,
    totalItems: 0,
    hasMore: true
  });
  protected isLoadingSignal: WritableSignal<boolean> = signal(false);

  // Subjects for scroll handling
  protected scrollSubject = new Subject<number>();
  protected loadMoreSubject = new BehaviorSubject<boolean>(false);

  // Public readable signals
  public readonly paginatedAssets: Signal<PaginatedAsset<TAsset>[]> = this.paginatedAssetsSignal.asReadonly();
  public readonly paginationState: Signal<PaginationState> = this.paginationStateSignal.asReadonly();
  public readonly isLoading: Signal<boolean> = this.isLoadingSignal.asReadonly();
  
  // Computed signals
  public readonly displayedItemsCount = computed(() => this.paginatedAssetsSignal().length);
  public readonly hasMoreItems = computed(() => this.paginationStateSignal().hasMore);

  constructor() {
    this.initializeScrollHandling();
  }

  private initializeScrollHandling(): void {
    // Debounce scroll events to prevent excessive loading
    this.scrollSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(scrollPercentage => {
      if (scrollPercentage >= 70 && !this.isLoadingSignal() && this.hasMoreItems()) {
        this.loadMore();
      }
    });
  }

  /**
   * Initialize the service with assets from the store
   */
  public abstract initialize(assets: TAsset[]): void;

  /**
   * Load metadata for a specific asset
   */
  protected abstract loadMetadata(asset: TAsset): Promise<TMetadata | null>;

  /**
   * Get unique identifier for an asset
   */
  protected abstract getAssetId(asset: TAsset): string;

  /**
   * Reset pagination and reload
   */
  public reset(): void {
    this.paginatedAssetsSignal.set([]);
    this.paginationStateSignal.update(state => ({
      ...state,
      currentPage: 0,
      hasMore: true
    }));
  }

  /**
   * Load more items with pagination
   */
  public async loadMore(): Promise<void> {
    if (this.isLoadingSignal() || !this.hasMoreItems()) {
      return;
    }

    this.isLoadingSignal.set(true);

    try {
      const state = this.paginationStateSignal();
      const startIndex = state.currentPage * state.pageSize;
      const endIndex = startIndex + state.pageSize;
      
      // Get next batch of assets
      const assets = this.getAssetsFromStore();
      const nextBatch = assets.slice(startIndex, endIndex);

      if (nextBatch.length === 0) {
        this.paginationStateSignal.update(s => ({ ...s, hasMore: false }));
        return;
      }

      // Create paginated assets without metadata
      const paginatedBatch: PaginatedAsset<TAsset>[] = nextBatch.map(asset => ({
        data: asset,
        metadata: undefined,
        isLoadingMetadata: false
      }));

      // Add to displayed items
      this.paginatedAssetsSignal.update(items => [...items, ...paginatedBatch]);
      
      // Update pagination state
      this.paginationStateSignal.update(state => ({
        ...state,
        currentPage: state.currentPage + 1,
        hasMore: endIndex < assets.length
      }));

      // Load metadata for visible items (defer to next tick)
      setTimeout(() => {
        this.loadMetadataForVisibleItems();
      }, 0);

    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Load metadata for items that are visible in the viewport
   */
  public async loadMetadataForVisibleItems(itemElements?: HTMLElement[]): Promise<void> {
    const items = this.paginatedAssetsSignal();
    const itemsToLoad = items.filter(item => 
      !item.metadata && !item.isLoadingMetadata && !item.metadataError
    );

    // If itemElements are provided, only load metadata for visible ones
    if (itemElements && itemElements.length > 0) {
      const visibleIndices = this.getVisibleItemIndices(itemElements);
      const visibleItemsToLoad = itemsToLoad.filter((_, index) => visibleIndices.includes(index));
      await this.loadMetadataForItems(visibleItemsToLoad);
    } else {
      // Load metadata for all items without metadata
      await this.loadMetadataForItems(itemsToLoad);
    }
  }

  private getVisibleItemIndices(itemElements: HTMLElement[]): number[] {
    const viewportHeight = window.innerHeight;
    const indices: number[] = [];

    itemElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        indices.push(index);
      }
    });

    return indices;
  }

  private async loadMetadataForItems(items: PaginatedAsset<TAsset>[]): Promise<void> {
    const promises = items.map(async (item) => {
      const assetId = this.getAssetId(item.data);
      
      // Mark as loading
      this.updateItemMetadataState(assetId, { isLoadingMetadata: true });

      try {
        const metadata = await this.loadMetadata(item.data);
        this.updateItemMetadataState(assetId, {
          metadata,
          isLoadingMetadata: false,
          metadataError: undefined
        });
      } catch (error) {
        console.error(`Failed to load metadata for asset ${assetId}:`, error);
        this.updateItemMetadataState(assetId, {
          isLoadingMetadata: false,
          metadataError: 'Failed to load metadata'
        });
      }
    });

    await Promise.all(promises);
  }

  private updateItemMetadataState(assetId: string, updates: Partial<PaginatedAsset<TAsset>>): void {
    this.paginatedAssetsSignal.update(items => 
      items.map(item => 
        this.getAssetId(item.data) === assetId 
          ? { ...item, ...updates }
          : item
      )
    );
  }

  /**
   * Handle scroll event
   */
  public onScroll(scrollPercentage: number): void {
    this.scrollSubject.next(scrollPercentage);
  }

  /**
   * Get assets from store - to be implemented by subclasses
   */
  protected abstract getAssetsFromStore(): TAsset[];
} 