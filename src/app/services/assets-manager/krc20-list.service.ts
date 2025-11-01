import { computed, effect, inject, Injectable, signal, Signal } from '@angular/core';
import { GetTokenListDto } from '../kasplex-api/dtos/token-list-info.dto';
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
export class Krc20ListService {
  private l1AssetsStore = inject(L1AssetsStoreService);
  private walletService = inject(WalletService);
  
  private readonly config = L1_PAGINATION_CONFIG.krc20;
  private readonly storeTokensSignal = this.l1AssetsStore.getAssetSignal(L1AssetType.KRC20);
  private readonly storeLoadingSignal = this.l1AssetsStore.getAssetLoadingSignal(L1AssetType.KRC20);
  
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
   * Computed: KRC20 token data from store
   * Flattened for component consumption
   */
  tokens: Signal<GetTokenListDto[]> = computed(() => {
    return this.l1AssetsStore.getAssets(L1AssetType.KRC20) as GetTokenListDto[];
  });
  
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
    
    // Watch for data from store and mark initial load complete
    // Note: We DON'T reset pagination when store data changes due to auto-reload merging
    // Auto-reload merges data and preserves pagination state
    effect(() => {
      const tokens = this.tokens();
      const currentState = this.paginationState();
      
      if (tokens && tokens.length > 0 && !currentState.initialLoadComplete) {
        // Initial load complete
        this.paginationState.update(state => ({
          ...state,
          initialLoadComplete: true,
          isLoading: false
        }));
      }
    });
  }
  
  /**
   * Load initial page of KRC20 tokens
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
      
      this.paginationState.update(state => ({
        ...state,
        isLoading: false,
        initialLoadComplete: true
      }));
    } catch (error) {
      console.error('Error loading initial KRC20 tokens:', error);
      this.paginationState.update(state => ({
        ...state,
        isLoading: false
      }));
    }
  }
  
  /**
   * Load more KRC20 tokens (next page)
   * Called by component when scroll threshold is reached
   * 
   * @returns Promise<LoadMoreResult> Result of the load operation
   * 
   * @example
   * ```typescript
   * const result = await this.krc20ListService.loadMore();
   * if (result.success) {
   *   console.log(`Loaded ${result.itemsAdded} more tokens`);
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
      const result = await this.l1AssetsStore.loadMoreKrc20Tokens();
      
      if (result.success) {
        this.paginationState.update(s => ({
          ...s,
          cursor: result.nextCursor ?? undefined,
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
      console.error('[KRC20ListService] ❌ Exception during loadMore:', error);
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

