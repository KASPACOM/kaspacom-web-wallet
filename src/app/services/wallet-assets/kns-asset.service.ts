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
  private currentPage: number = 1;
  private readonly pageSize: number = 20;

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
    if (!wallet) return;
    
    this.currentPage++;
    await this.fetchAssets(wallet);
  }

  override async loadPreviousPage(wallet: AppWallet): Promise<void> {
    if (!wallet || this.currentPage <= 1) return;
    
    this.currentPage--;
    await this.fetchAssets(wallet);
  }

  override reset(): void {
    this.assets = [];
    this.currentPage = 1;
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
          page: this.currentPage,
          pageSize: this.pageSize
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
      const totalPages = response?.data?.pagination?.totalPages || 0;

      // Update the assets array
      if (this.currentPage === 1) {
        this.assets = newAssets;
      } else {
        this.assets = [...this.assets, ...newAssets];
      }

      // Update signal with paginated data
      this.data.set({
        data: [this.assets],
        totalItems,
        hasNextPage: this.currentPage < totalPages
      });
    } catch (err) {
      console.error('Error fetching KNS assets:', err);
      throw err;
    }
  }
} 