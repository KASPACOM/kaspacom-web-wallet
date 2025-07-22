import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BaseAssetMetadataService } from './base-asset-metadata.service';
import { AssetsStoreService } from '../assets-store.service';
import { KasplexKrc20Service } from '../kasplex-api/kasplex-api.service';
import { GetTokenListDto } from '../kasplex-api/dtos/token-list-info.dto';

export interface Krc20TokenWithMetadata extends GetTokenListDto {
  maxSupply?: string;
  minted?: string;
  holders?: string;
  state?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Krc20MetadataService extends BaseAssetMetadataService<GetTokenListDto, Krc20TokenWithMetadata> {
  private assetsStore = inject(AssetsStoreService);
  private kasplexService = inject(KasplexKrc20Service);
  
  private allAssets: GetTokenListDto[] = [];

  constructor() {
    super();
  }

  public override initialize(assets?: GetTokenListDto[]): void {
    // Use provided assets or get from store
    this.allAssets = assets || this.assetsStore.krc20Assets();
    
    // Update pagination state
    this.paginationStateSignal.update(state => ({
      ...state,
      totalItems: this.allAssets.length,
      hasMore: this.allAssets.length > 0 // Reset hasMore flag based on available assets
    }));

    // Reset pagination state and load initial page
    // This ensures stale data from previous wallet is cleared
    this.reset();
    
    // Only load more if we have assets to display
    if (this.allAssets.length > 0) {
      this.loadMore();
    }
  }

  protected override getAssetsFromStore(): GetTokenListDto[] {
    // Always use the latest from store if no custom assets provided
    return this.allAssets.length > 0 ? this.allAssets : this.assetsStore.krc20Assets();
  }

  protected override getAssetId(asset: GetTokenListDto): string {
    return asset.tick;
  }

  protected override async loadMetadata(asset: GetTokenListDto): Promise<Krc20TokenWithMetadata | null> {
    try {
      const response = await firstValueFrom(
        this.kasplexService.getTokenInfo(asset.tick)
      );

      if (response.message === 'successful' && response.result?.[0]) {
        const tokenInfo = response.result[0];
        return {
          ...asset,
          maxSupply: tokenInfo.max,
          minted: tokenInfo.minted,
          holders: tokenInfo.holderTotal,
          state: tokenInfo.state
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to load metadata for KRC20 token ${asset.tick}:`, error);
      return null;
    }
  }

  /**
   * Get enriched token data with metadata
   */
  public getEnrichedTokenData(tick: string): Krc20TokenWithMetadata | undefined {
    const item = this.paginatedAssetsSignal().find(
      item => this.getAssetId(item.data) === tick
    );
    
    if (item?.metadata) {
      return item.metadata;
    } else if (item) {
      return item.data;
    }
    
    return undefined;
  }

  /**
   * Refresh data from store and reinitialize
   */
  public refreshFromStore(): void {
    this.allAssets = this.assetsStore.krc20Assets();
    this.initialize(this.allAssets);
  }
} 