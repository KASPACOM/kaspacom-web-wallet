import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, effect } from '@angular/core';
import { AppWallet } from '../../../classes/AppWallet';
import { AssetType, WalletAssetsManagerService } from '../../../services/wallet-assets/wallet-assets-manager.service';
import { PagedData } from '../../../services/wallet-assets/base-asset.service';
import { WalletAddressToken } from '../../../services/krc721-api/model/wallet-address-tokens-response.interface';

@Component({
  selector: 'app-krc721-assets',
  standalone: true,
  templateUrl: './krc721-assets.component.html',
  styleUrls: ['./krc721-assets.component.scss'],
  imports: [NgIf, NgFor, CommonModule]
})
export class Krc721AssetsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() wallet!: AppWallet;
  @Input() refreshTrigger: number = 0;

  tokens: WalletAddressToken[] = [];
  isLoading = false;
  error: string | null = null;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  private expandedTokens = new Set<string>();

  constructor(private assetsManager: WalletAssetsManagerService) {
    // Set up effects for signals
    const krc721Service = this.assetsManager.getAssetService<WalletAddressToken>(AssetType.KRC721);
    
    effect(() => {
      this.isLoading = krc721Service.isLoading();
    });

    effect(() => {
      this.error = krc721Service.error();
    });

    effect(() => {
      const data: PagedData<WalletAddressToken> = krc721Service.data();
      if (data.data.length > 0) {
        this.tokens = data.data[0];
        this.totalPages = Math.ceil(data.totalItems / this.pageSize);
      }
    });
  }

  ngOnInit(): void {
    this.loadTokens();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.currentPage = 1;
      this.loadTokens();
    }
  }

  ngOnDestroy(): void {
    // Effects are automatically cleaned up
  }

  loadTokens(): void {
    if (!this.wallet) return;
    this.assetsManager.refreshAssetType(AssetType.KRC721);
  }

  loadAllData(): void {
    if (!this.wallet) return;
    const service = this.assetsManager.getAssetService<WalletAddressToken>(AssetType.KRC721);
    service.loadAllData(this.wallet);
  }

  getPaginatedTokens(): WalletAddressToken[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.tokens.slice(startIndex, endIndex);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.assetsManager.loadNextPage(AssetType.KRC721);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.assetsManager.loadPreviousPage(AssetType.KRC721);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get hasPrevPage(): boolean {
    return this.currentPage > 1;
  }

  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }

  toggleTokenInfo(tokenId: string): void {
    if (this.expandedTokens.has(tokenId)) {
      this.expandedTokens.delete(tokenId);
    } else {
      this.expandedTokens.add(tokenId);
    }
  }

  isTokenExpanded(tokenId: string): boolean {
    return this.expandedTokens.has(tokenId);
  }

  get imageUrl(): string {
    return this.tokens[0]?.buri || 'assets/placeholder-nft.png';
  }

  get contractAddress(): string {
    return this.tokens[0]?.tick || '';
  }
} 