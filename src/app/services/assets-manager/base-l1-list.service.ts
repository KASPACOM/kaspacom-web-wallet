import { Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { L1AssetsStoreService } from './assets-stores/l1-assets-store.service';
import { WalletService } from '../wallet.service';
import { L1AssetType } from './enums/l1-asset-type.enum';
import {
  LoadMoreResult,
  PaginationConfig,
  PaginationState,
  PaginationStatus,
} from './interfaces/pagination-state.interface';

export interface L1LoadMoreStoreResult {
  success: boolean;
  itemsAdded: number;
  hasMore: boolean;
  nextCursor: string | number | undefined;
  error?: string;
}

export abstract class BaseL1ListService<TAsset> {
  protected readonly l1AssetsStore = inject(L1AssetsStoreService);
  protected readonly walletService = inject(WalletService);

  private readonly paginationStateSignal: WritableSignal<PaginationState>;
  private readonly dataGrewFromMergeSignal: WritableSignal<boolean>;
  protected readonly itemsSignal: Signal<TAsset[]>;

  readonly isLoading: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly isFetching: Signal<boolean>;
  readonly initialLoadComplete: Signal<boolean>;
  readonly shouldCheckScrollPosition: Signal<boolean>;

  private lastWalletAddress: string | undefined;

  protected constructor(
    private readonly assetType: L1AssetType,
    protected readonly config: PaginationConfig
  ) {
    this.paginationStateSignal = signal<PaginationState>({
      cursor: undefined,
      hasMore: true,
      isLoading: false,
      pageSize: this.config.pageSize,
      totalLoaded: 0,
      initialLoadComplete: false,
    });

    this.dataGrewFromMergeSignal = signal<boolean>(false);

    this.itemsSignal = computed(() =>
      (this.l1AssetsStore.getAssets(this.assetType) as TAsset[]) || []
    );

    this.isLoading = computed(() => this.paginationStateSignal().isLoading);
    this.hasMore = computed(() => this.paginationStateSignal().hasMore);
    this.isFetching = computed(() => this.isLoading());
    this.initialLoadComplete = computed(() => this.paginationStateSignal().initialLoadComplete);
    this.shouldCheckScrollPosition = computed(() => this.dataGrewFromMergeSignal());

    this.setupWalletWatcher();
    this.setupDataWatcher();
  }

  protected abstract loadMoreFromStore(): Promise<L1LoadMoreStoreResult>;

  getPaginationState(): Signal<PaginationState> {
    return this.paginationStateSignal.asReadonly();
  }

  reset(): void {
    this.paginationStateSignal.set({
      cursor: undefined,
      hasMore: true,
      isLoading: false,
      pageSize: this.config.pageSize,
      totalLoaded: 0,
      initialLoadComplete: false,
    });
  }

  refetch(): void {
    this.reset();
    this.loadInitial();
  }

  async loadInitial(): Promise<void> {
    if (this.paginationStateSignal().initialLoadComplete) {
      return;
    }

    this.paginationStateSignal.update((state) => ({
      ...state,
      isLoading: true,
    }));

    try {
      this.paginationStateSignal.update((state) => ({
        ...state,
        isLoading: false,
        initialLoadComplete: true,
      }));
    } catch (error) {
      console.error('Error during initial load:', error);
      this.paginationStateSignal.update((state) => ({
        ...state,
        isLoading: false,
      }));
    }
  }

  async loadMore(): Promise<LoadMoreResult> {
    const stateSnapshot = this.paginationStateSignal();

    if (stateSnapshot.isLoading || !stateSnapshot.hasMore) {
      return {
        success: false,
        itemsAdded: 0,
        totalItems: stateSnapshot.totalLoaded,
        hasMore: stateSnapshot.hasMore,
        status: stateSnapshot.isLoading ? PaginationStatus.LOADING : PaginationStatus.IDLE,
      };
    }

    this.paginationStateSignal.update((state) => ({
      ...state,
      isLoading: true,
    }));

    try {
      const result = await this.loadMoreFromStore();

      if (result.success) {
        this.paginationStateSignal.update((state) => ({
          ...state,
          cursor: result.nextCursor,
          hasMore: result.hasMore,
          isLoading: false,
          totalLoaded: state.totalLoaded + result.itemsAdded,
        }));
      } else {
        this.paginationStateSignal.update((state) => ({
          ...state,
          isLoading: false,
        }));
      }

      return {
        success: result.success,
        itemsAdded: result.itemsAdded,
        totalItems: this.paginationStateSignal().totalLoaded,
        hasMore: result.hasMore,
        status: result.success ? PaginationStatus.SUCCESS : PaginationStatus.ERROR,
        error: result.error,
      };
    } catch (error) {
      console.error('[BaseL1ListService] Exception during loadMore:', error);
      this.paginationStateSignal.update((state) => ({
        ...state,
        isLoading: false,
      }));

      return {
        success: false,
        itemsAdded: 0,
        totalItems: stateSnapshot.totalLoaded,
        hasMore: stateSnapshot.hasMore,
        status: PaginationStatus.ERROR,
        error: (error as Error).message,
      };
    }
  }

  protected getItemsSignal(): Signal<TAsset[]> {
    return this.itemsSignal;
  }

  private setupWalletWatcher(): void {
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
  }

  private setupDataWatcher(): void {
    let previousLength = 0;

    effect(() => {
      const assets = this.itemsSignal();
      const currentState = this.paginationStateSignal();
      const currentLength = assets?.length ?? 0;

      if (currentLength > 0) {
        if (previousLength > 0 && currentLength > previousLength && currentState.initialLoadComplete) {
          const itemsAdded = currentLength - previousLength;
          const isLikelyMerge = itemsAdded !== this.config.pageSize;

          if (isLikelyMerge) {
            this.dataGrewFromMergeSignal.set(true);
            setTimeout(() => this.dataGrewFromMergeSignal.set(false), 100);
          }

          this.paginationStateSignal.update((state) => ({
            ...state,
            totalLoaded: currentLength,
          }));
        }

        if (!currentState.initialLoadComplete) {
          this.paginationStateSignal.update((state) => ({
            ...state,
            initialLoadComplete: true,
            isLoading: false,
          }));
        }
      } else if (previousLength > 0) {
        this.paginationStateSignal.update((state) => ({
          ...state,
          totalLoaded: 0,
        }));
      }

      previousLength = currentLength;
    });
  }
}

