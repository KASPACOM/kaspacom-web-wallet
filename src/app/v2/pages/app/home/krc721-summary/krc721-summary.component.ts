import { Component, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { INft } from '../../common/interfaces/nft.interface';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Krc721ApiService } from '../../../../../services/krc721-api/krc721-api.service';
import { WalletService } from '../../../../../services/wallet.service';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-krc721-summary',
  imports: [TitleCasePipe, UpperCasePipe, SkeletonComponent],
  templateUrl: './krc721-summary.component.html',
  styleUrl: './krc721-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Krc721SummaryComponent implements OnInit {
  private walletService = inject(WalletService);
  private krc721Service = inject(Krc721ApiService);
  private router = inject(Router);

  nfts = signal<INft[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadKrc721Nfts();
  }

  onNftClick(nft: INft): void {
    // Navigate to the KRC721 asset detail page
    this.router.navigate(['/app/home/asset/krc721', nft.tick, nft.tokenId]);
  }

  private async loadKrc721Nfts() {
    try {
      this.loading.set(true);
      const currentWallet = this.walletService.getCurrentWallet();

      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      const response = await firstValueFrom(
        this.krc721Service.getAddressNfts(currentWallet.getAddress())
      );

      console.log('KRC721 API Response:', response);

      if (response.message === 'success' && response.result) {
        // First, create NFTs with basic data
        const basicNfts: INft[] = response.result.map(nft => ({
          tick: nft.tick,
          tokenId: nft.tokenId,
          owner: currentWallet.getAddress(),
          name: undefined,
          description: undefined,
          attributes: undefined
        }));

        this.nfts.set(basicNfts);

        // Then load metadata for each NFT
        await this.loadNftMetadata(basicNfts);
      }
    } catch (error) {
      console.error('Failed to load KRC721 NFTs:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadNftMetadata(nfts: INft[]) {
    try {
      // Load metadata for up to 10 NFTs to avoid too many requests
      const nftsToLoad = nfts.slice(0, 10);
      
      const metadataRequests = nftsToLoad.map(nft => 
        this.krc721Service.getNftMetadata(nft.tick, nft.tokenId)
      );

      const metadataResponses = await firstValueFrom(
        forkJoin(metadataRequests)
      );

      // Update NFTs with metadata
      const updatedNfts = nfts.map((nft, index) => {
        if (index < metadataResponses.length && metadataResponses[index]) {
          const metadata = metadataResponses[index];
          return {
            ...nft,
            name: metadata.name,
            description: metadata.description,
            attributes: metadata.attributes,
            // Store image data for easy access
            image: metadata.image
          } as INft & { image?: string };
        }
        return nft;
      });

      this.nfts.set(updatedNfts);
    } catch (error) {
      console.error('Failed to load NFT metadata:', error);
    }
  }

  // Helper method to get display name
  getDisplayName(nft: INft): string {
    if (nft.name) {
      return nft.name;
    }
    return `${nft.tick.toUpperCase()} #${nft.tokenId}`;
  }

  // Helper method to get image URL
  getImageUrl(nft: INft): string {
    const nftWithImage = nft as INft & { image?: string };
    if (nftWithImage.image) {
      // Convert IPFS URL to HTTP URL if needed
      if (nftWithImage.image.startsWith('ipfs://')) {
        return nftWithImage.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return nftWithImage.image;
    }
    return '';
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8c3ZnIHg9IjEyIiB5PSIxMiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz4KPGR5bGluZSB4MT0iMjEiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iNiIvPgo8L3N2Zz4KPC9zdmc+';
    }
  }
} 