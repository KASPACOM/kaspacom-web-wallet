import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { INft } from '../../../../../common/interfaces/nft.interface';
import { Krc721ApiService } from '../../../../../../../../services/krc721-api/krc721-api.service';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-send-nft',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule, SkeletonComponent],
  templateUrl: './send-nft.component.html',
  styleUrl: './send-nft.component.scss'
})
export class SendNftComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private krc721Service = inject(Krc721ApiService);
  
  nft = signal<INft | undefined>(undefined);
  loading = signal<boolean>(true);
  walletAddress = '';
  replaceByFee = false;
  
  constructor() {
    super();
    
    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-nft') {
        this.loadNftData();
      }
    });
  }
  
  override async ngOnInit(): Promise<void> {
    // Initial load will be handled by the effect
  }
  
  get config(): IFlowPageConfig {
    const currentNft = this.nft();
    return {
      id: 'send-nft',
      title: `Send ${currentNft?.name || currentNft?.tick || 'NFT'}`,
      canNavigateBack: true
    };
  }
  
  get isFormValid(): boolean {
    return this.walletAddress.trim().length > 0;
  }
  
  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
  }
  
  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }
  
  onSendClick(): void {
    const currentNft = this.nft();
    if (!this.isFormValid || !currentNft) {
      return;
    }
    
    // Handle send NFT transaction logic here
    console.log('Send NFT:', {
      nft: currentNft,
      walletAddress: this.walletAddress,
      replaceByFee: this.replaceByFee
    });
  }

  private async loadNftData(): Promise<void> {
    try {
      this.loading.set(true);
      
      // Clear form data when loading new NFT
      this.walletAddress = '';
      this.replaceByFee = false;
      
      // Get navigation data
      const navigationData = this.getNavigationData();
      
      if (!navigationData || !navigationData.tick || !navigationData.tokenId) {
        console.warn('No NFT tick/tokenId provided in navigation data');
        return;
      }

      const currentWallet = this.walletService.getCurrentWallet();
      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      // Create basic NFT object
      const basicNft: INft = {
        tick: navigationData.tick,
        tokenId: navigationData.tokenId,
        owner: currentWallet.getAddress(),
        name: undefined,
        description: undefined,
        attributes: undefined,
        image: undefined
      };

      this.nft.set(basicNft);

      // Load metadata
      await this.loadNftMetadata(basicNft);
    } catch (error) {
      console.error('Failed to load NFT data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadNftMetadata(nft: INft): Promise<void> {
    try {
      const metadata = await firstValueFrom(
        this.krc721Service.getNftMetadata(nft.tick, nft.tokenId)
      );

      if (metadata) {
        const updatedNft: INft = {
          ...nft,
          name: metadata.name,
          description: metadata.description,
          attributes: metadata.attributes,
          image: this.processImageUrl(metadata.image)
        };

        this.nft.set(updatedNft);
      }
    } catch (error) {
      console.error('Failed to load NFT metadata:', error);
    }
  }

  private getNavigationData(): any {
    // Get data from current page configuration
    const currentPage = this.getCurrentConfig();
    return currentPage?.data || {};
  }

  private processImageUrl(imageUrl?: string): string | undefined {
    if (!imageUrl) return undefined;
    
    // Convert IPFS URLs to HTTP
    if (imageUrl.startsWith('ipfs://')) {
      return imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return imageUrl;
  }

  // Helper method to get display name
  getDisplayName(): string {
    const currentNft = this.nft();
    if (currentNft?.name) {
      return currentNft.name;
    }
    return `${currentNft?.tick?.toUpperCase()} #${currentNft?.tokenId}`;
  }

  // Helper method to get image URL
  getImageUrl(): string {
    const currentNft = this.nft();
    if (currentNft?.image) {
      // Convert IPFS URL to HTTP URL if needed
      if (currentNft.image.startsWith('ipfs://')) {
        return currentNft.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return currentNft.image;
    }
    return '';
  }

  onImageError(event: Event): void {
    // Hide the image on error and let the placeholder show
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  }
}