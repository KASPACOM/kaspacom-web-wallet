import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, effect } from '@angular/core';
import { AppWallet } from '../../../classes/AppWallet';
import { TokenDetailsResponse } from '../../../interfaces/krc721-api.interface';
import { AssetType, WalletAssetsManagerService } from '../../../services/wallet-assets/wallet-assets-manager.service';
import { PagedData } from '../../../services/wallet-assets/base-asset.service';

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

  nfts: TokenDetailsResponse[] = [];
  isLoading = false;
  error: string | null = null;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(private assetsManager: WalletAssetsManagerService) {
    // Set up effects for signals
    const krc721Service = this.assetsManager.getAssetService<TokenDetailsResponse>(AssetType.KRC721);
    
    effect(() => {
      this.isLoading = krc721Service.isLoading();
    });

    effect(() => {
      this.error = krc721Service.error();
    });

    effect(() => {
      const data: PagedData<TokenDetailsResponse> = krc721Service.data();
      if (data.data.length > 0) {
        this.nfts = data.data[0];
        this.totalPages = Math.ceil(data.totalItems / this.pageSize);
      }
    });
  }

  ngOnInit(): void {
    this.loadNfts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.currentPage = 1;
      this.loadNfts();
    }
  }

  ngOnDestroy(): void {
    // Effects are automatically cleaned up
  }

  loadNfts(): void {
    if (!this.wallet) return;
    this.assetsManager.refreshAssetType(AssetType.KRC721);
  }

  loadAllData(): void {
    if (!this.wallet) return;
    const service = this.assetsManager.getAssetService<TokenDetailsResponse>(AssetType.KRC721);
    service.loadAllData(this.wallet);
  }

  getPaginatedNfts(): TokenDetailsResponse[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.nfts.slice(startIndex, endIndex);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
} 