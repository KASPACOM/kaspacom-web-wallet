import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, effect } from '@angular/core';
import { AppWallet } from '../../../classes/AppWallet';
import { KnsWalletAsset } from '../../../services/kns-api/model/kns-wallet-assets-response.interface';
import { AssetType, WalletAssetsManagerService } from '../../../services/wallet-assets/wallet-assets-manager.service';
import { PagedData } from '../../../services/wallet-assets/base-asset.service';

@Component({
  selector: 'app-kns-assets',
  standalone: true,
  templateUrl: './kns-assets.component.html',
  styleUrls: ['./kns-assets.component.scss'],
  imports: [NgIf, NgFor, CommonModule]
})
export class KnsAssetsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() wallet!: AppWallet;
  @Input() refreshTrigger: number = 0;

  assets: KnsWalletAsset[] = [];
  isLoading = true;
  error: string | null = null;
  
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;

  // Track expanded state for each asset
  expandedAssets = new Set<string>();

  constructor(private assetsManager: WalletAssetsManagerService) {
    // Set up effects for signals
    const knsService = this.assetsManager.getAssetService<KnsWalletAsset>(AssetType.KNS);
    
    effect(() => {
      this.isLoading = knsService.isLoading();
    });

    effect(() => {
      this.error = knsService.error();
    });

    effect(() => {
      const data: PagedData<KnsWalletAsset> = knsService.data();
      if (data.data.length > 0) {
        this.assets = data.data[0];
        this.totalPages = Math.ceil(data.totalItems / this.pageSize);
        // Clear expanded states when data changes
        this.expandedAssets.clear();
      }
    });
  }

  ngOnInit(): void {
    this.loadAssets();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.currentPage = 1;
      this.loadAssets();
    }
  }

  ngOnDestroy(): void {
    // Effects are automatically cleaned up
  }

  loadAssets(): void {
    if (!this.wallet) return;
    this.assetsManager.refreshAssetType(AssetType.KNS);
  }

  loadAllData(): void {
    if (!this.wallet) return;
    const service = this.assetsManager.getAssetService<KnsWalletAsset>(AssetType.KNS);
    service.loadAllData(this.wallet);
  }

  getPaginatedAssets(): KnsWalletAsset[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.assets.slice(startIndex, endIndex);
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

  toggleAssetInfo(assetId: string): void {
    if (this.expandedAssets.has(assetId)) {
      this.expandedAssets.delete(assetId);
    } else {
      this.expandedAssets.add(assetId);
    }
  }

  isAssetExpanded(assetId: string): boolean {
    return this.expandedAssets.has(assetId);
  }
} 