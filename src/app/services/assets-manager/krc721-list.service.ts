import { computed, effect, inject, Injectable, signal, Signal } from '@angular/core';
import { Krc721Nft } from '../krc721-api/dtos/krc721-nft.dto';
import { L1AssetsStoreService } from './assets-stores/l1-assets-store.service';
import { WalletService } from '../wallet.service';
import { L1AssetType } from './enums/l1-asset-type.enum';
import {
  LoadMoreResult,
  PaginationState,
  PaginationStatus,
  L1_PAGINATION_CONFIG
} from './interfaces/pagination-state.interface';

@Injectable({
  providedIn: 'root'
})
export class Krc721ListService {
  private l1AssetsStore = inject(L1AssetsStoreService);
  private walletService = inject(WalletService);
  
  private readonly config = L1_PAGINATION_CONFIG.krc721;
  private readonly storeNftsSignal = this.l1AssetsStore.getAssetSignal(L1AssetType.KRC721);
  private readonly storeLoadingSignal = this.l1AssetsStore.getAssetLoadingSignal(L1AssetType.KRC721);
  
  /**
   * Internal pagination state
   * Private signal to manage loading state, cursor, and pagination metadata
   */
  private paginationState = signal<PaginationState>({
    cursor: undefined,
    hasMore: true,
    isLoading: false,
    pageSize: this.config.pageSize,
    totalLoaded: 0,
    initialLoadComplete: false
  });
  
  /**
   * Flag to indicate data grew from auto-reload merge
   * Components should check scroll position when this happens
   */
  private dataGrewFromMerge = signal<boolean>(false);
  
  /**
   * Computed: NFT data from store
   * Flattened for component consumption
   */
  nfts: Signal<Krc721Nft[]> = computed(() => {
    return this.l1AssetsStore.getAssets(L1AssetType.KRC721) as Krc721Nft[];
  });
  
  /**
   * Signal to notify components when data size increased from merge
   * Components should manually check scroll to reset threshold
   */
  shouldCheckScrollPosition: Signal<boolean> = computed(() => this.dataGrewFromMerge());
  
  /**
   * Computed: Loading state
   * True when actively loading data
   */
  isLoading: Signal<boolean> = computed(() => {
    return this.paginationState().isLoading;
  });
  
  /**
   * Computed: Has more items
   * True if more items are available to load
   */
  hasMore: Signal<boolean> = computed(() => {
    return this.paginationState().hasMore;
  });
  
  /**
   * Computed: Is fetching (alias for isLoading)
   * For compatibility with portfolio pattern
   */
  isFetching: Signal<boolean> = computed(() => {
    return this.isLoading();
  });
  
  /**
   * Computed: Initial load complete
   * True after first page has been loaded
   */
  initialLoadComplete: Signal<boolean> = computed(() => {
    return this.paginationState().initialLoadComplete;
  });
  
  private lastWalletAddress: string | undefined;

  constructor() {
    // Watch for wallet changes and reset pagination
    // Only reset if wallet address actually changed (not just signal re-evaluation)
    effect(() => {
      const wallet = this.walletService.getCurrentWallet();
      const currentAddress = wallet?.getAddress();
      
      if (currentAddress && currentAddress !== this.lastWalletAddress) {
        this.lastWalletAddress = currentAddress;
        this.reset();
      } else if (currentAddress) {
        this.lastWalletAddress = currentAddress;
      }
    });
    
    // Watch for data changes and detect merges vs. manual loads
    // This helps components reset scroll threshold when needed
    let previousLength = 0;
    effect(() => {
      const nfts = this.nfts();
      const currentState = this.paginationState();
      
      if (nfts && nfts.length > 0) {
        const currentLength = nfts.length;
        
        // Detect if new items were added (from merge or loadMore)
        if (previousLength > 0 && currentLength > previousLength && currentState.initialLoadComplete) {
          const itemsAdded = currentLength - previousLength;
          
          // If items added doesn't match page size, it's likely a merge
          // (loadMore always adds exactly pageSize items, unless last page)
          const isLikelyMerge = itemsAdded !== this.config.pageSize;
          
          if (isLikelyMerge) {
            this.dataGrewFromMerge.set(true);
            setTimeout(() => this.dataGrewFromMerge.set(false), 100);
          }
          
          // Update totalLoaded to reflect actual count
          this.paginationState.update(s => ({
            ...s,
            totalLoaded: currentLength
          }));
        }
        
        previousLength = currentLength;
        
        // Mark initial load complete
        if (!currentState.initialLoadComplete) {
          this.paginationState.update(state => ({
            ...state,
            initialLoadComplete: true,
            isLoading: false
          }));
        }
      }
    });
  }
  
  /**
   * Load initial page of NFTs
   * Called automatically on component init or wallet change
   * 
   * @returns Promise that resolves when initial load completes
   */
  async loadInitial(): Promise<void> {
    if (this.paginationState().initialLoadComplete) {
      // Already loaded, don't reload
      return;
    }
    
    this.paginationState.update(state => ({
      ...state,
      isLoading: true
    }));
    
    try {
      // Note: L1AssetsStore's initial load is triggered by the store itself
      // We just need to wait for it and update our state
      
      // For now, we'll mark as complete. The store handles the actual loading.
      // In the next step, we'll refactor the store to work with this service.
      this.paginationState.update(state => ({
        ...state,
        isLoading: false,
        initialLoadComplete: true
      }));
    } catch (error) {
      console.error('Error loading initial KRC721 NFTs:', error);
      this.paginationState.update(state => ({
        ...state,
        isLoading: false
      }));
    }
  }
  
  /**
   * Load more NFTs (next page)
   * Called by component when scroll threshold is reached
   * 
   * @returns Promise<LoadMoreResult> Result of the load operation
   * 
   * @example
   * ```typescript
   * const result = await this.krc721ListService.loadMore();
   * if (result.success) {
   *   console.log(`Loaded ${result.itemsAdded} more NFTs`);
   * }
   * ```
   */
  async loadMore(): Promise<LoadMoreResult> {
    const state = this.paginationState();
    
    // Don't load if already loading or no more items
    if (state.isLoading || !state.hasMore) {
      return {
        success: false,
        itemsAdded: 0,
        totalItems: state.totalLoaded,
        hasMore: state.hasMore,
        status: state.isLoading ? PaginationStatus.LOADING : PaginationStatus.IDLE
      };
    }
    
    this.paginationState.update(s => ({
      ...s,
      isLoading: true
    }));
    
    try {
      const result = await this.l1AssetsStore.loadMoreKrc721Nfts();
      
      if (result.success) {
        this.paginationState.update(s => ({
          ...s,
          cursor: result.nextCursor,
          hasMore: result.hasMore,
          isLoading: false,
          totalLoaded: s.totalLoaded + result.itemsAdded
        }));
      } else {
        this.paginationState.update(s => ({
          ...s,
          isLoading: false
        }));
      }
      
      return {
        success: result.success,
        itemsAdded: result.itemsAdded,
        totalItems: this.paginationState().totalLoaded,
        hasMore: result.hasMore,
        status: result.success ? PaginationStatus.SUCCESS : PaginationStatus.ERROR,
        error: result.error
      };
    } catch (error) {
      console.error('[KRC721ListService] Exception during loadMore:', error);
      this.paginationState.update(s => ({
        ...s,
        isLoading: false
      }));
      
      return {
        success: false,
        itemsAdded: 0,
        totalItems: state.totalLoaded,
        hasMore: state.hasMore,
        status: PaginationStatus.ERROR,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Reset pagination state
   * Called on wallet changes or manual refresh
   */
  reset(): void {
    this.paginationState.set({
      cursor: undefined,
      hasMore: true,
      isLoading: false,
      pageSize: this.config.pageSize,
      totalLoaded: 0,
      initialLoadComplete: false
    });
  }
  
  /**
   * Refetch data
   * Resets state and triggers initial load
   */
  refetch(): void {
    this.reset();
    this.loadInitial();
  }
  
  /**
   * Get current pagination state (for debugging)
   */
  getPaginationState(): Signal<PaginationState> {
    return this.paginationState.asReadonly();
  }
}

