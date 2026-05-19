import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton';
import { NftRankTagComponent } from './components/nft-rank-tag/nft-rank-tag.component';
import { BaseAssetPageComponent } from '../../../../../common/base-asset-page/base-asset-page.component';
import { Krc721ApiService } from '../../../../../../../../services/krc721-api/krc721-api.service';
import { FlowPagesService } from '../../../../../../../services/flow-pages.service';
import { KaspaL1NetworkService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';

interface NftMetadata {
  name?: string;
  description?: string;
  image?: string;
  tokenid?: number;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

@Component({
  selector: 'app-krc721-asset',
  standalone: true,
  imports: [
    CommonModule,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent,
    NftRankTagComponent
  ],
  templateUrl: './krc721-asset.component.html',
  styleUrl: './krc721-asset.component.scss'
})
export class Krc721AssetComponent extends BaseAssetPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private krc721Service = inject(Krc721ApiService);
  private flowPagesService = inject(FlowPagesService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private tick: string = '';
  private tokenId: string = '';

  protected nftMetadata = signal<NftMetadata | null>(null);
  protected metadataLoading = signal<boolean>(true);

  protected rarityRank = signal<number | undefined>(undefined);
  protected legendary = signal<boolean | undefined>(undefined);
  protected totalSupply = signal<number | undefined>(undefined);

  override async ngOnInit() {
    // Get the tick and tokenId from route params
    this.route.params.subscribe(params => {
      this.tick = params['tick'];
      this.tokenId = params['tokenId'];
      if (this.tick && this.tokenId) {
        super.ngOnInit();
        // Ensure we try to load metadata/rarity even if tick case doesn't match API perfectly
        this.loadNftMetadata();
        this.loadRarityInfo();
      }
    });
  }

  protected override async loadAssetData(): Promise<void> {
    if (!this.tick || !this.tokenId) {
      this.loading.set(false);
      return;
    }

    try {
      this.loading.set(true);

      // Set basic asset details
      const assetDetail = {
        name: this.tick.toUpperCase(),
        symbol: this.tick.toUpperCase(),
        balance: '1', // NFTs always have a balance of 1
        decimals: 0
      };

      this.assetDetail.set(assetDetail);
    } catch (error) {
      console.error('Failed to load KRC721 asset data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadNftMetadata(): Promise<void> {
    try {
      this.metadataLoading.set(true);

      const metadata = await firstValueFrom(
        this.krc721Service.getNftMetadata(this.tick, this.tokenId)
      );

      if (metadata) {
        this.nftMetadata.set(metadata);
      }
    } catch (error) {
      console.error('Failed to load NFT metadata:', error);
    } finally {
      this.metadataLoading.set(false);
    }
  }

  protected async loadRarityInfo(): Promise<void> {
    try {
      const address = this.getCurrentWalletAddress();
      console.log('Loading rarity info for', this.tick, this.tokenId, 'address:', address);

      // 1. Get Collection details for total supply
      this.krc721Service.getCollectionDetails(this.tick).subscribe(response => {
        console.log('Collection details response:', response);
        if (response.message === 'success') {
          // Use max supply if totalSupply is missing, or minted if available
          const supply = response.result.totalSupply || response.result.max || response.result.minted;
          this.totalSupply.set(parseInt(supply));
          console.log('Total supply set to:', parseInt(supply));
        }
      });

      // 2. Get Portfolio details for rarity rank
      const details = await firstValueFrom(this.krc721Service.getPortfolioDetails(address, this.tick));
      console.log('Portfolio details response:', details);

      if (details && details.length > 0) {
        // Compare tickers case-insensitively
        const detailItem = details.find(d => d.ticker.toUpperCase() === this.tick.toUpperCase());
        console.log('Found detail item:', detailItem);

        if (detailItem && detailItem.tokenIds) {
          // Handle both object and string formats
          const token = detailItem.tokenIds.find((t: any) => {
            const id = (typeof t === 'object' && t.tokenId !== undefined) ? t.tokenId : t;
            return id.toString() === this.tokenId.toString();
          });

          console.log('Found token:', token);

          if (token && typeof token === 'object') {
            console.log('Setting rarity rank:', token.rarityRank, 'legendary:', token.legendary);
            this.rarityRank.set(token.rarityRank);
            this.legendary.set(token.legendary);
          } else {
            console.log('Token is not an object or not found');
          }
        } else {
          console.log('No detail item or tokenIds found');
        }
      } else {
        console.log('No portfolio details found');
      }
    } catch (e) {
      console.error('Failed to load rarity info', e);
    }
  }



  protected override async loadTransactionHistory(): Promise<void> {
    // For now, we'll skip transaction history for NFTs
    // This could be implemented later if needed
    this.transactions.set([]);
    this.historyLoading.set(false);
  }

  protected override onSendAction(): void {
    if (!this.tick || !this.tokenId) {
      console.warn('No tick or tokenId available');
      return;
    }

    const nftMetadata = this.nftMetadata();

    // Create NFT data for the send form
    const nftData = {
      tick: this.tick,
      tokenId: this.tokenId,
      owner: this.getCurrentWalletAddress(),
      name: nftMetadata?.name,
      description: nftMetadata?.description,
      attributes: nftMetadata?.attributes,
      image: nftMetadata?.image
    };

    // Navigate directly to the send NFT form with NFT pre-selected
    this.flowPagesService.openFlow({
      id: 'send-nft',
      title: `Send ${this.getDisplayName()}`,
      canNavigateBack: true,
      data: { nft: nftData }
    });
  }

  protected override goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'krc721' } });
  }

  // Helper method to get display name
  getDisplayName(): string {
    const metadata = this.nftMetadata();
    if (metadata?.name) {
      return metadata.name;
    }
    return `${this.tick.toUpperCase()} #${this.tokenId}`;
  }

  // Helper method to get image URL
  getImageUrl(): string {
    const cachedImageUrl = this.buildCachedImageUrl();
    if (cachedImageUrl) {
      return cachedImageUrl;
    }

    const metadata = this.nftMetadata();
    const fallbackImage = metadata?.image;
    if (fallbackImage) {
      if (fallbackImage.startsWith('ipfs://')) {
        return fallbackImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return fallbackImage;
    }
    return '';
  }

  // Helper method to get description
  getDescription(): string {
    const metadata = this.nftMetadata();
    return metadata?.description || '';
  }

  // Helper method to get attributes
  getAttributes(): Array<{ trait_type: string; value: string | number }> {
    const metadata = this.nftMetadata();
    return metadata?.attributes || [];
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjMzMzIiByeD0iMTIiLz4KPHN2ZyB4PSI5NiIgeT0iOTYiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiI+CjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIi8+CjxjaXJjbGUgY3g9Ijg1IiBjeT0iOC41IiByPSIxLjUiLz4KPGR5bGluZSB4MT0iMjEiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iNiIvPgo8L3N2Zz4KPC9zdmc+';
    }
  }

  private buildCachedImageUrl(): string {
    const cacheStreamUrl = this.kaspaL1NetworkService.getKrc721CacheStreamUrl();
    if (!this.tick || !this.tokenId || !cacheStreamUrl) {
      return '';
    }

    const normalizedTick = encodeURIComponent(this.tick.toUpperCase());
    const normalizedTokenId = encodeURIComponent(this.tokenId);
    return `${cacheStreamUrl}/optimized/${normalizedTick}/${normalizedTokenId}`;
  }

  // Open NFT in explorer (currently not implemented as transaction ID is not readily available)
  // This could be enhanced in the future by loading ownership history or operations
  protected openInExplorer(): void {
    // For now, we could search for the NFT by tick and tokenId
    // or implement a method to get the transaction ID from operations
    console.log('Explorer functionality for KRC721 needs transaction ID from operations');
  }
}
