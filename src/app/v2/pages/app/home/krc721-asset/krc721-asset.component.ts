import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { BaseAssetPageComponent } from '../../common/base-asset-page/base-asset-page.component';
import { Krc721ApiService } from '../../../../../services/krc721-api/krc721-api.service';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

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
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent
  ],
  templateUrl: './krc721-asset.component.html',
  styleUrl: './krc721-asset.component.scss'
})
export class Krc721AssetComponent extends BaseAssetPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private krc721Service = inject(Krc721ApiService);

  private tick: string = '';
  private tokenId: string = '';
  
  protected nftMetadata = signal<NftMetadata | null>(null);
  protected metadataLoading = signal<boolean>(true);

  override async ngOnInit() {
    // Get the tick and tokenId from route params
    this.route.params.subscribe(params => {
      this.tick = params['tick'];
      this.tokenId = params['tokenId'];
      if (this.tick && this.tokenId) {
        super.ngOnInit();
        this.loadNftMetadata();
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

  protected override async loadTransactionHistory(): Promise<void> {
    // For now, we'll skip transaction history for NFTs
    // This could be implemented later if needed
    this.transactions.set([]);
    this.historyLoading.set(false);
  }

  protected override onSendAction(): void {
    // TODO: Navigate to send KRC721 form
    console.log('Send KRC721 action triggered for:', this.tick, this.tokenId);
  }

  protected override goBack(): void {
    this.router.navigate(['/app/home']);
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
    const metadata = this.nftMetadata();
    if (metadata?.image) {
      // Convert IPFS URL to HTTP URL if needed
      if (metadata.image.startsWith('ipfs://')) {
        return metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return metadata.image;
    }
    return '';
  }

  // Helper method to get description
  getDescription(): string {
    const metadata = this.nftMetadata();
    return metadata?.description || '';
  }

  // Helper method to get attributes
  getAttributes(): Array<{trait_type: string; value: string | number}> {
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
} 