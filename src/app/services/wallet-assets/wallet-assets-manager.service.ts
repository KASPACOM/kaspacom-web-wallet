import { Injectable, OnDestroy, effect } from '@angular/core';
import { AppWallet } from '../../classes/AppWallet';
import { WalletService } from '../wallet.service';
import { Krc20AssetService } from './krc20-asset.service';
import { KnsAssetService } from './kns-asset.service';
import { Krc721AssetService } from './krc721-asset.service';
import { BehaviorSubject } from 'rxjs';
import { BaseAssetService } from './base-asset.service';

/**
 * Enum of supported asset types
 * This makes it easier to add new asset types in the future
 */
export enum AssetType {
  KRC20 = 'krc20',
  KNS = 'kns',
  KRC721 = 'krc721'
}

type AssetServiceMap = {
  [key in AssetType]: BaseAssetService<any>;
};

@Injectable({
  providedIn: 'root'
})
export class WalletAssetsManagerService implements OnDestroy {
  private currentWallet: AppWallet | null = null;
  private refreshSubject = new BehaviorSubject<number>(0);
  
  /**
   * Map of asset types to their respective services
   * This makes it easier to iterate over services and add new ones in the future
   */
  private assetServices: AssetServiceMap;
  
  // Flag to track when we're loading all pages
  private isLoadingAllPages = false;
  
  private walletChangeEffect = effect(() => {
    const wallet = this.walletService.getCurrentWalletSignal()();
    if (wallet && (!this.currentWallet || wallet.getAddress() !== this.currentWallet.getAddress())) {
      this.currentWallet = wallet;
      this.resetAllServices();
      this.loadAllAssets(wallet);
    }
  });
  
  constructor(
    private walletService: WalletService,
    private krc20AssetService: Krc20AssetService,
    private knsAssetService: KnsAssetService,
    private krc721AssetService: Krc721AssetService
  ) {
    // Initialize the asset services map
    this.assetServices = {
      [AssetType.KRC20]: this.krc20AssetService,
      [AssetType.KNS]: this.knsAssetService,
      [AssetType.KRC721]: this.krc721AssetService
    };
  }

  ngOnDestroy(): void {
    // The effect will be automatically cleaned up
  }

  /**
   * Reset all services
   */
  private resetAllServices(): void {
    Object.values(this.assetServices).forEach(service => service.reset());
  }

  /**
   * Load all assets for a wallet
   */
  private loadAllAssets(wallet: AppWallet): void {
    // Load all data for each asset type
    Object.values(this.assetServices).forEach(service => {
      service.loadAllData(wallet);
    });
  }

  /**
   * Refresh all assets
   */
  public refreshAllAssets(): void {
    if (this.currentWallet) {
      this.resetAllServices();
      this.loadAllAssets(this.currentWallet);
      this.refreshSubject.next(this.refreshSubject.value + 1);
    }
  }

  /**
   * Refresh specific asset type
   */
  public refreshAssetType(type: AssetType): void {
    if (!this.currentWallet) return;

    const service = this.assetServices[type];
    if (!service) return;

    // Reset the service first
    service.reset();
    
    // Load all data for this type
    service.loadAllData(this.currentWallet);
  }

  /**
   * Get the asset service for a specific type
   */
  public getAssetService<T>(type: AssetType): BaseAssetService<T> {
    return this.assetServices[type] as BaseAssetService<T>;
  }

  /**
   * Get the refresh trigger observable
   * Components can subscribe to this to react to refresh events
   */
  public get refreshTrigger$() {
    return this.refreshSubject.asObservable();
  }

  /**
   * Load next page for a specific asset type
   * Note: This is mostly for the UI to trigger loading while we wait for background loading
   */
  public loadNextPage(type: AssetType): void {
    if (!this.currentWallet) return;

    const service = this.assetServices[type];
    if (service) {
      service.loadNextPage(this.currentWallet);
    }
  }

  /**
   * Load previous page for a specific asset type
   * Note: Since we're loading all pages, this just navigates through already loaded data
   */
  public loadPreviousPage(type: AssetType): void {
    if (!this.currentWallet) return;

    const service = this.assetServices[type];
    if (service) {
      service.loadPreviousPage(this.currentWallet);
    }
  }
  
  /**
   * Search through all loaded assets of a specific type
   * @param type The asset type to search
   * @param searchFn A function that returns true for items that match the search
   * @returns An array of matching items
   */
  public searchAssets<T>(type: AssetType, searchFn: (item: T) => boolean): T[] {
    const service = this.assetServices[type];
    if (!service) return [];
    
    const allData = service.data();
    // Flatten all pages into a single array and filter with the search function
    return allData.data.flatMap(page => page.filter(searchFn));
  }
} 