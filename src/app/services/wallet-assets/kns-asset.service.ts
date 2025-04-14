import { Injectable } from '@angular/core';
import { BaseAssetService, PagedData } from './base-asset.service';
import { AppWallet } from '../../classes/AppWallet';
import { KnsApiService } from '../kns-api/kns-api.service';
import { KnsWalletAsset } from '../kns-api/model/kns-wallet-assets-response.interface';
import { KnsWalletAssetStatus } from '../kns-api/model/kns-wallet-assets-params.interface';
import { catchError, firstValueFrom, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class KnsAssetService extends BaseAssetService<KnsWalletAsset> {
  private assets: KnsWalletAsset[] = [];

  constructor(private knsApiService: KnsApiService) {
    super();
  }

  override async loadAssets(wallet: AppWallet, refresh = false): Promise<void> {
    if (!wallet) return;

    if (refresh) {
      this.reset();
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.fetchAssets(wallet);
    } catch (error) {
      console.error('Error loading KNS assets:', error);
      this.error.set('Failed to load KNS assets');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadNextPage(wallet: AppWallet): Promise<void> {
    // No pagination needed
    return;
  }

  override async loadPreviousPage(wallet: AppWallet): Promise<void> {
    // No pagination needed
    return;
  }

  override reset(): void {
    this.assets = [];
    this.data.set({
      data: [[]],
      totalItems: 0,
      hasNextPage: false
    });
  }

  private async fetchAssets(wallet: AppWallet): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.knsApiService.getKnsWalletAssets({
          owner: wallet.getAddress(),
          page: 1,
          pageSize: 20 // Large page size to get all assets at once
        }).pipe(
          catchError((err) => {
            console.error('Error fetching KNS assets:', err);
            return of({ 
              success: false, 
              data: { 
                assets: [], 
                pagination: { 
                  currentPage: 1, 
                  pageSize: 0, 
                  totalItems: 0, 
                  totalPages: 0 
                } 
              } 
            });
          })
        )
      );

      const newAssets = response?.data?.assets || [];
      const totalItems = response?.data?.pagination?.totalItems || 0;

      // Update the data
      this.assets = newAssets;

      // Update signal with all assets in a single page
      this.data.set({
        data: [this.assets],
        totalItems,
        hasNextPage: false
      });
    } catch (err) {
      console.error('Error fetching KNS assets:', err);
      throw err;
    }
  }
} 