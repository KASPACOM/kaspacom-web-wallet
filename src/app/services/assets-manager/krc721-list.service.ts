import { Injectable, Signal, signal, computed, inject } from '@angular/core';
import { Krc721Nft } from '../krc721-api/dtos/krc721-nft.dto';
import { L1AssetType } from './enums/l1-asset-type.enum';
import { LoadMoreResult, L1_PAGINATION_CONFIG } from './interfaces/pagination-state.interface';
import { BaseL1ListService, L1LoadMoreStoreResult } from './base-l1-list.service';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Krc721ListService extends BaseL1ListService<Krc721Nft> {
  private krc721ApiService = inject(Krc721ApiService);

  // Filtering state
  readonly tickerFilter = signal<string>('');
  readonly filteredNfts = signal<Krc721Nft[]>([]);
  readonly isFilteringLoading = signal<boolean>(false);

  // Computed nfts that switches between main store list and filtered list
  readonly nfts: Signal<Krc721Nft[]>;

  constructor() {
    super(L1AssetType.KRC721, L1_PAGINATION_CONFIG.krc721);

    const storeNfts = this.getItemsSignal();

    this.nfts = computed(() => {
      const filter = this.tickerFilter();
      if (filter) {
        return this.filteredNfts();
      }
      return storeNfts();
    });
  }

  // Override isLoading to include filtering state
  override isLoading = computed(() => {
    return this.getPaginationState()().isLoading || this.isFilteringLoading();
  });

  getAvailableTickers(): Signal<string[]> {
    return this.l1AssetsStore.krc721AvailableTickers;
  }

  async setFilter(ticker: string) {
    this.tickerFilter.set(ticker);

    if (!ticker) {
      this.filteredNfts.set([]);
      return;
    }

    this.isFilteringLoading.set(true);
    try {
      const walletAddress = this.walletService.getCurrentWallet()?.getAddress();
      if (!walletAddress) {
        this.filteredNfts.set([]);
        return;
      }
      const nfts = await this.krc721ApiService.getWalletNftsByCollection(walletAddress, ticker);
      this.filteredNfts.set(nfts);
    } catch (error) {
      console.error(`Error filtering by ticker ${ticker}:`, error);
      this.filteredNfts.set([]);
    } finally {
      this.isFilteringLoading.set(false);
    }
  }

  protected override loadMoreFromStore(): Promise<L1LoadMoreStoreResult> {
    // If filtering, we don't load more from store (or we could depending on API, but simple list for now)
    if (this.tickerFilter()) {
      return Promise.resolve({
        success: true,
        itemsAdded: 0,
        hasMore: false,
        nextCursor: undefined
      });
    }
    return this.l1AssetsStore.loadMoreKrc721Nfts();
  }
}

