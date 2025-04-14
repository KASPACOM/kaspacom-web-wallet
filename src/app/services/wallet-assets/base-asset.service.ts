import { Signal, signal } from '@angular/core';
import { AppWallet } from '../../classes/AppWallet';

export interface PagedData<T> {
  data: T[][];
  totalItems: number;
  hasNextPage: boolean;
}

export abstract class BaseAssetService<T> {
  isLoading = signal(false);
  error = signal<string | null>(null);
  data = signal<PagedData<T>>({
    data: [],
    totalItems: 0,
    hasNextPage: false
  });

  /**
   * Loads assets for the given wallet
   * @param wallet The wallet to load assets for
   * @param refresh Whether to force refresh
   */
  abstract loadAssets(wallet: AppWallet, refresh?: boolean): Promise<void>;

  /**
   * Loads the next page of assets
   * @param wallet The wallet to load assets for
   */
  abstract loadNextPage(wallet: AppWallet): Promise<void>;

  /**
   * Loads the previous page of assets
   * @param wallet The wallet to load assets for
   */
  abstract loadPreviousPage(wallet: AppWallet): Promise<void>;

  /**
   * Resets the service state for wallet changes
   */
  abstract reset(): void;

  /**
   * Loads all available pages of data
   * @param wallet The wallet to load assets for
   * @param maxPages Maximum number of pages to load (default: 100)
   */
  async loadAllData(wallet: AppWallet, maxPages: number = 100): Promise<void> {
    if (!wallet) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load first page
      await this.loadAssets(wallet);

      // Keep loading next pages until no more pages or max pages reached
      let currentPage = 1;
      while (this.data().hasNextPage && currentPage < maxPages) {
        await this.loadNextPage(wallet);
        currentPage++;
      }
    } catch (error) {
      console.error('Error loading all data:', error);
      this.error.set('Failed to load all data');
    } finally {
      this.isLoading.set(false);
    }
  }
} 