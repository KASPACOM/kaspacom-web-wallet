import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BaseAssetMetadataService } from './base-asset-metadata.service';
import { KasplexKrc20Service } from '../kasplex-api/kasplex-api.service';
import { GetTokenListDto } from '../kasplex-api/dtos/token-list-info.dto';
import { L1_ASSET_KEYS } from '../assets-manager/assets-stores/l1-assets-store.service';
import { AssetsManagerService } from '../assets-manager/assets-manager.service';

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
  protected assetsManager: AssetsManagerService;

  private kasplexService = inject(KasplexKrc20Service);
  
  constructor() {
    const assetsManager = inject(AssetsManagerService);

    super(assetsManager.getAllAssetStores().l1, L1_ASSET_KEYS.krc20);
  
    this.assetsManager = assetsManager;
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

} 