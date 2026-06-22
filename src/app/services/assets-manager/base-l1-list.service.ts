import { DestroyRef, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { L1AssetStoreData, L1AssetsStoreService } from './assets-stores/l1-assets-store.service';
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
  private readonly rawItemsSignal: Signal<TAsset[] | undefined>;
  protected readonly itemsSignal: Signal<TAsset[]>;

  readonly isLoading: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly isFetching: Signal<boolean>;
  readonly initialLoadComplete: Signal<boolean>;
  readonly shouldCheckScrollPosition: Signal<boolean>;

  private lastWalletAddress: string | undefined;
  private previousLength = 0;
  private mergeFlagResetTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly destroyRef = inject(DestroyRef);

  protected constructor(
    private readonly assetType: L1AssetType,
    protected readonly config: PaginationConfig
  ) {
    this.paginationStateSignal = signal<PaginationState>({
      cursor: undefined,
      hasMore: true,
      isLoading: false,
      pageSize: this.config.pageSize,
      initialLoadComplete: false,
    });

    this.dataGrewFromMergeSignal = signal<boolean>(false);

    this.rawItemsSignal = this.l1AssetsStore.getAssetSignal(
      this.assetType as keyof L1AssetStoreData,
    ) as Signal<TAsset[] | undefined>;
    this.itemsSignal = computed(() => this.rawItemsSignal() ?? []);

    this.isLoading = computed(() => this.paginationStateSignal().isLoading);
    this.hasMore = computed(() => this.paginationStateSignal().hasMore);
    this.isFetching = computed(() => this.isLoading());
    this.initialLoadComplete = computed(() => this.paginationStateSignal().initialLoadComplete);
    this.shouldCheckScrollPosition = computed(() => this.dataGrewFromMergeSignal());

    this.setupWalletWatcher();

    const removeListener = this.l1AssetsStore.onAssetsUpdated(
      this.assetType as keyof L1AssetStoreData,
      (items) => this.handleItemsUpdated(items as TAsset[] | undefined),
    );

    this.destroyRef.onDestroy(() => {
      removeListener();
      if (this.mergeFlagResetTimeout) {
        clearTimeout(this.mergeFlagResetTimeout);
        this.mergeFlagResetTimeout = undefined;
      }
    });

    this.previousLength = this.itemsSignal().length;
    this.handleItemsUpdated(this.rawItemsSignal());
  }

  protected abstract loadMoreFromStore(): Promise<L1LoadMoreStoreResult>;

  getPaginationState(): Signal<PaginationState> {
    return this.paginationStateSignal.asReadonly();
  }

  reset(): void {
    const shouldLoad = this.shouldLoadCurrentAsset();
    this.paginationStateSignal.set({
      cursor: undefined,
      hasMore: shouldLoad,
      isLoading: false,
      pageSize: this.config.pageSize,
      initialLoadComplete: !shouldLoad,
    });
    if (this.mergeFlagResetTimeout) {
      clearTimeout(this.mergeFlagResetTimeout);
      this.mergeFlagResetTimeout = undefined;
    }
    this.dataGrewFromMergeSignal.set(false);
    this.previousLength = 0;
  }

  refetch(): void {
    this.reset();
    this.loadInitial();
  }

  async loadInitial(): Promise<void> {
    if (!this.shouldLoadCurrentAsset()) {
      this.markUnsupportedAssetComplete();
      return;
    }

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

    if (!this.shouldLoadCurrentAsset()) {
      this.markUnsupportedAssetComplete();
      return {
        success: false,
        itemsAdded: 0,
        totalItems: this.itemsSignal().length,
        hasMore: false,
        status: PaginationStatus.IDLE,
      };
    }

    if (stateSnapshot.isLoading || !stateSnapshot.hasMore) {
      return {
        success: false,
        itemsAdded: 0,
        totalItems: this.itemsSignal().length,
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
        totalItems: this.itemsSignal().length,
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
        totalItems: this.itemsSignal().length,
        hasMore: stateSnapshot.hasMore,
        status: PaginationStatus.ERROR,
        error: (error as Error).message,
      };
    }
  }

  protected getItemsSignal(): Signal<TAsset[]> {
    return this.itemsSignal;
  }

  private shouldLoadCurrentAsset(): boolean {
    return this.l1AssetsStore.supportsAssetType(this.assetType);
  }

  private markUnsupportedAssetComplete(): void {
    this.paginationStateSignal.set({
      cursor: undefined,
      hasMore: false,
      isLoading: false,
      pageSize: this.config.pageSize,
      initialLoadComplete: true,
    });
    if (this.mergeFlagResetTimeout) {
      clearTimeout(this.mergeFlagResetTimeout);
      this.mergeFlagResetTimeout = undefined;
    }
    this.dataGrewFromMergeSignal.set(false);
    this.previousLength = 0;
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

  private handleItemsUpdated(items: TAsset[] | undefined): void {
    const currentState = this.paginationStateSignal();
    const hasItems = Array.isArray(items);
    const currentLength = hasItems ? items!.length : 0;

    if (hasItems && !currentState.initialLoadComplete) {
      this.paginationStateSignal.update((state) => ({
        ...state,
        initialLoadComplete: true,
        isLoading: false,
      }));
    }

    if (
      currentLength > this.previousLength &&
      currentState.initialLoadComplete
    ) {
      const itemsAdded = currentLength - this.previousLength;
      const isLikelyMerge = itemsAdded !== this.config.pageSize;

      if (isLikelyMerge) {
        this.dataGrewFromMergeSignal.set(true);
        if (this.mergeFlagResetTimeout) {
          clearTimeout(this.mergeFlagResetTimeout);
        }
        this.mergeFlagResetTimeout = setTimeout(() => {
          this.dataGrewFromMergeSignal.set(false);
          this.mergeFlagResetTimeout = undefined;
        }, 100);
      }
    }

    if (currentLength === 0 && this.previousLength > 0) {
      if (this.mergeFlagResetTimeout) {
        clearTimeout(this.mergeFlagResetTimeout);
        this.mergeFlagResetTimeout = undefined;
      }
      this.dataGrewFromMergeSignal.set(false);
    }

    this.previousLength = currentLength;
  }
}
