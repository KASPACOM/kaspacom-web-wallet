import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, effect } from '@angular/core';
import { AppWallet } from '../../../classes/AppWallet';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { Krc20Token } from '../../../services/wallet-assets/krc20-asset.service';
import { AssetType, WalletAssetsManagerService } from '../../../services/wallet-assets/wallet-assets-manager.service';
import { PagedData } from '../../../services/wallet-assets/base-asset.service';

@Component({
  selector: 'app-krc20-assets',
  standalone: true,
  templateUrl: './krc20-assets.component.html',
  styleUrls: ['./krc20-assets.component.scss'],
  imports: [NgIf, NgFor, CommonModule, SompiToNumberPipe]
})
export class Krc20AssetsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() wallet!: AppWallet;
  @Input() refreshTrigger: number = 0;

  tokens: Krc20Token[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  
  constructor(private assetsManager: WalletAssetsManagerService) {
    // Set up effects for signals
    const krc20Service = this.assetsManager.getAssetService<Krc20Token>(AssetType.KRC20);
    
    effect(() => {
      this.isLoading = krc20Service.isLoading();
    });
    
    effect(() => {
      this.error = krc20Service.error();
    });
    
    effect(() => {
      const data: PagedData<Krc20Token> = krc20Service.data();
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
    this.assetsManager.refreshAssetType(AssetType.KRC20);
  }

  loadAllData(): void {
    if (!this.wallet) return;
    const service = this.assetsManager.getAssetService<Krc20Token>(AssetType.KRC20);
    service.loadAllData(this.wallet);
  }

  getPaginatedTokens(): Krc20Token[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.tokens.slice(startIndex, endIndex);
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

  getCurrentPageTokens(): Krc20Token[] {
    return this.getPaginatedTokens();
  }

  get hasPrevPage(): boolean {
    return this.currentPage > 1;
  }

  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }
} 