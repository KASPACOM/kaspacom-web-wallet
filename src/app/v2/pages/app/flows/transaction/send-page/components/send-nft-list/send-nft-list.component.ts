import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { INft } from '../../../../../common/interfaces/nft.interface';
import { Krc721ApiService } from '../../../../../../../../services/krc721-api/krc721-api.service';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { firstValueFrom, forkJoin } from 'rxjs';

@Component({
  selector: 'app-send-nft-list',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, DatePipe],
  templateUrl: './send-nft-list.component.html',
  styleUrl: './send-nft-list.component.scss'
})
export class SendNftListComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private krc721Service = inject(Krc721ApiService);
  
  nfts = signal<INft[]>([]);
  loading = signal<boolean>(true);

  get config(): IFlowPageConfig {
    return {
      id: 'send-nft-list',
      title: 'Select NFT',
      canNavigateBack: true
    };
  }

  override async ngOnInit() {
    await this.loadNfts();
  }

  private async loadNfts() {
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
          attributes: undefined,
          image: undefined
        }));

        this.nfts.set(basicNfts);

        // Then load metadata for each NFT
        await this.loadNftMetadata(basicNfts);
      }
    } catch (error) {
      console.error('Failed to load NFTs:', error);
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
            image: this.processImageUrl(metadata.image)
          };
        }
        return nft;
      });

      this.nfts.set(updatedNfts);
    } catch (error) {
      console.error('Failed to load NFT metadata:', error);
    }
  }

  private processImageUrl(imageUrl?: string): string | undefined {
    if (!imageUrl) return undefined;
    
    // Convert IPFS URLs to HTTP
    if (imageUrl.startsWith('ipfs://')) {
      return imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return imageUrl;
  }

  onNftClick(nft: INft): void {
    this.navigateToNextPage({
      id: 'send-nft',
      title: `Send ${nft.name || nft.tick}`,
      canNavigateBack: true,
      data: {
        tick: nft.tick,
        tokenId: nft.tokenId
      }
    });
  }

  onImageError(event: any): void {
    // Set fallback placeholder SVG
    event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzI4MjgyOCIvPgo8cGF0aCBkPSJNMTYgMjBMMjAgMjRIMjhMMzIgMjBWMzJIMTZWMjBaIiBmaWxsPSIjNDA0MDQwIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9IiM2MDYwNjAiLz4KPC9zdmc+';
  }
}