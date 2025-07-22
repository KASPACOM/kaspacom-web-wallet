import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BaseAssetMetadataService } from './base-asset-metadata.service';
import { AssetsStoreService } from '../assets-store.service';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { Krc721Nft, Krc721Metadata } from '../krc721-api/dtos/krc721-nft.dto';

export interface Krc721NftWithMetadata extends Krc721Nft {
  metadataLoaded?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class Krc721MetadataService extends BaseAssetMetadataService<Krc721Nft, Krc721Metadata> {
  private assetsStore = inject(AssetsStoreService);
  private krc721Service = inject(Krc721ApiService);
  
  private allAssets: Krc721Nft[] = [];

  constructor() {
    super();
  }

  public override initialize(assets?: Krc721Nft[]): void {
    // Use provided assets or get from store
    this.allAssets = assets || this.assetsStore.krc721Assets();
    
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

  protected override getAssetsFromStore(): Krc721Nft[] {
    // Always use the latest from store if no custom assets provided
    return this.allAssets.length > 0 ? this.allAssets : this.assetsStore.krc721Assets();
  }

  protected override getAssetId(asset: Krc721Nft): string {
    return `${asset.tick}-${asset.tokenId}`;
  }

  protected override async loadMetadata(asset: Krc721Nft): Promise<Krc721Metadata | null> {
    try {
      const metadata = await firstValueFrom(
        this.krc721Service.getNftMetadata(asset.tick, asset.tokenId)
      );

      if (metadata) {
        return metadata;
      }

      return null;
    } catch (error) {
      console.error(`Failed to load metadata for NFT ${asset.tick}#${asset.tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get enriched NFT data with metadata
   */
  public getEnrichedNftData(tick: string, tokenId: string): Krc721NftWithMetadata | undefined {
    const assetId = `${tick}-${tokenId}`;
    const item = this.paginatedAssetsSignal().find(
      item => this.getAssetId(item.data) === assetId
    );
    
    if (item) {
      return {
        ...item.data,
        metadata: item.metadata || item.data.metadata,
        metadataLoaded: !!item.metadata
      };
    }
    
    return undefined;
  }

  /**
   * Get display name for NFT
   */
  public getDisplayName(nft: Krc721Nft, metadata?: Krc721Metadata): string {
    const name = metadata?.name || nft.metadata?.name;
    if (name) {
      return name;
    }
    return `${nft.tick.toUpperCase()} #${nft.tokenId}`;
  }

  /**
   * Get image URL for NFT
   */
  public getImageUrl(nft: Krc721Nft, metadata?: Krc721Metadata): string {
    const image = metadata?.image || nft.metadata?.image;
    if (image) {
      // Convert IPFS URL to HTTP URL if needed
      if (image.startsWith('ipfs://')) {
        return image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return image;
    }
    return '';
  }

  /**
   * Refresh data from store and reinitialize
   */
  public refreshFromStore(): void {
    this.allAssets = this.assetsStore.krc721Assets();
    this.initialize(this.allAssets);
  }

  /**
   * Filter NFTs by collection
   */
  public filterByCollection(tick: string): void {
    const filteredAssets = this.assetsStore.krc721Assets().filter(
      nft => nft.tick === tick
    );
    this.initialize(filteredAssets);
  }
} 