import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BaseAssetMetadataService } from './base-asset-metadata.service';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { Krc721Nft, Krc721Metadata } from '../krc721-api/dtos/krc721-nft.dto';
import { L1_ASSET_KEYS } from '../assets-manager/assets-stores/l1-assets-store.service';
import { AssetsManagerService } from '../assets-manager/assets-manager.service';
import { environment } from '../../../environments/environment';

export interface Krc721NftWithMetadata extends Krc721Nft {
  metadataLoaded?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class Krc721MetadataService extends BaseAssetMetadataService<Krc721Nft, Krc721Metadata> {
  private krc721Service = inject(Krc721ApiService);
  
  constructor(protected assetsManager: AssetsManagerService) {
    super(assetsManager.getAllAssetStores().l1, L1_ASSET_KEYS.krc721);
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
    const cachedImageUrl = this.buildCachedImageUrl(nft.tick, nft.tokenId);
    if (cachedImageUrl) {
      return cachedImageUrl;
    }

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
   * Filter NFTs by collection
   */
  public filterByCollection(tick: string): void {
    const filteredAssets = this.getAssetsFromStore().filter(
      nft => nft.tick === tick
    );
    this.initialize(filteredAssets);
  }

  private buildCachedImageUrl(tick?: string, tokenId?: string): string {
    if (!tick || !tokenId || !environment.krc721CacheStreamUrl) {
      return '';
    }

    const normalizedTick = encodeURIComponent(tick.toUpperCase());
    const normalizedTokenId = encodeURIComponent(tokenId);
    return `${environment.krc721CacheStreamUrl}/optimized/${normalizedTick}/${normalizedTokenId}`;
  }
} 