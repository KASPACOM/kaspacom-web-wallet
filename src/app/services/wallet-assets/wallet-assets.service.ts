import { Injectable, OnDestroy, Signal, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { AppWallet } from '../../classes/AppWallet';
import { KaspaNetworkActionsService } from '../kaspa-netwrok-services/kaspa-network-actions.service';
import { KasplexKrc20Service } from '../kasplex-api/kasplex-api.service';
import { KnsApiService } from '../kns-api/kns-api.service';
import { KnsWalletAssetStatus } from '../kns-api/model/kns-wallet-assets-params.interface';
import { KnsWalletAsset } from '../kns-api/model/kns-wallet-assets-response.interface';
import { WalletService } from '../wallet.service';
import { effect } from '@angular/core';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { TokenDetailsResponse } from '../../interfaces/krc721-api.interface';

// Define interfaces for assets
export interface Krc20Token {
  ticker: string;
  balance: number;
}

export interface Krc721Token {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  contractAddress: string;
  tokenId: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletAssetsService implements OnDestroy {
  // KRC20 tokens state
  private krc20TokensSubject = new BehaviorSubject<Krc20Token[] | undefined>(undefined);
  public krc20Tokens$ = this.krc20TokensSubject.asObservable();
  public krc20IsLoading = signal(false);
  public krc20Error = signal<string | null>(null);
  public krc20HasPrevPage = signal(false);
  public krc20HasNextPage = signal(false);

  // KRC20 pagination
  private krc20PaginationPrevKey: string | null = null;
  private krc20PaginationNextKey: string | null = null;
  private krc20PaginationDirection: 'next' | 'prev' = 'next';

  // KNS assets state
  private listedKnsAssetsSubject = new BehaviorSubject<KnsWalletAsset[]>([]);
  public listedKnsAssets$ = this.listedKnsAssetsSubject.asObservable();

  private notListedKnsAssetsSubject = new BehaviorSubject<KnsWalletAsset[]>([]);
  public notListedKnsAssets$ = this.notListedKnsAssetsSubject.asObservable();

  public knsIsLoading = signal(false);
  public knsError = signal<string | null>(null);

  // KNS pagination
  private knsListedPage = 1;
  private knsNotListedPage = 1;
  private readonly knsPageSize = 50;
  public knsListedHasMore = signal(false);
  public knsNotListedHasMore = signal(false);

  // KRC721 tokens state
  private krc721TokensSubject = new BehaviorSubject<TokenDetailsResponse[]>([]);
  public krc721Tokens$ = this.krc721TokensSubject.asObservable();
  public krc721IsLoading = signal(false);
  public krc721Error = signal<string | null>(null);
  public krc721HasMore = signal(false);
  private krc721Offset: string | undefined;

  // All assets state
  private allAssetsSubject = new BehaviorSubject<{
    krc20: Krc20Token[] | undefined;
    knsListed: KnsWalletAsset[];
    knsNotListed: KnsWalletAsset[];
    krc721: TokenDetailsResponse[];
  }>({
    krc20: undefined,
    knsListed: [],
    knsNotListed: [],
    krc721: []
  });
  public allAssets$ = this.allAssetsSubject.asObservable();

  // Mock NFTs for demonstration
  private mockNfts: Krc721Token[] = [
    {
      id: '1',
      name: 'Sample NFT 1',
      description: 'This is a sample NFT for demonstration purposes.',
      imageUrl: 'https://via.placeholder.com/150',
      contractAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '1'
    },
    {
      id: '2',
      name: 'Sample NFT 2',
      description: 'Another sample NFT for demonstration purposes.',
      imageUrl: 'https://via.placeholder.com/150',
      contractAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '2'
    }
  ];

  // Watch for wallet changes
  private walletChangeEffect = effect(() => {
    const wallet = this.walletService.getCurrentWalletSignal()();
    if (wallet) {
      this.resetState();
      this.loadAllAssets(wallet);
    }
  });

  constructor(
    private walletService: WalletService,
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private knsApiService: KnsApiService,
    private krc721ApiService: Krc721ApiService
  ) {}

  ngOnDestroy(): void {
    // The effect will be automatically cleaned up
  }

  private resetState(): void {
    // Reset KRC20 state
    this.krc20TokensSubject.next(undefined);
    this.krc20PaginationPrevKey = null;
    this.krc20PaginationNextKey = null;
    this.krc20PaginationDirection = 'next';
    this.krc20IsLoading.set(false);
    this.krc20Error.set(null);
    this.krc20HasPrevPage.set(false);
    this.krc20HasNextPage.set(false);

    // Reset KNS state
    this.listedKnsAssetsSubject.next([]);
    this.notListedKnsAssetsSubject.next([]);
    this.knsListedPage = 1;
    this.knsNotListedPage = 1;
    this.knsIsLoading.set(false);
    this.knsError.set(null);
    this.knsListedHasMore.set(false);
    this.knsNotListedHasMore.set(false);

    // Reset KRC721 state
    this.krc721TokensSubject.next([]);
    this.krc721IsLoading.set(false);
    this.krc721Error.set(null);
    this.krc721HasMore.set(false);
    this.krc721Offset = undefined;

    // Reset all assets state
    this.allAssetsSubject.next({
      krc20: undefined,
      knsListed: [],
      knsNotListed: [],
      krc721: []
    });
  }

  private loadAllAssets(wallet: AppWallet): void {
    this.loadKrc20Tokens(wallet);
    this.loadKnsAssets(wallet);
    this.loadKrc721Tokens(wallet);
  }

  /**
   * KRC20 Token Methods
   */
  public refreshKrc20Tokens(wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      // Reset pagination for refresh
      this.krc20PaginationPrevKey = null;
      this.krc20PaginationNextKey = null;
      this.krc20PaginationDirection = 'next';
      this.krc20TokensSubject.next([]); // Clear tokens for refresh
      this.loadKrc20Tokens(currentWallet);
    }
  }

  public loadMoreKrc20Tokens(direction: 'next' | 'prev', wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      this.krc20PaginationDirection = direction;
      this.loadKrc20Tokens(currentWallet, true); // true indicates to append
    }
  }

  private async loadKrc20Tokens(wallet: AppWallet, append: boolean = false): Promise<void> {
    if (!wallet) return;

    this.krc20IsLoading.set(true);
    this.krc20Error.set(null);

    try {
      const paginationKey =
        this.krc20PaginationDirection === 'next'
          ? this.krc20PaginationNextKey
          : this.krc20PaginationPrevKey;

      const tokens = await firstValueFrom(
        this.kasplexService
          .getWalletTokenList(
            wallet.getAddress(),
            paginationKey,
            this.krc20PaginationDirection
          )
          .pipe(
            tap((response) => {
              this.krc20PaginationPrevKey = response.prev;
              this.krc20PaginationNextKey = response.next;
              
              // Update pagination signals
              this.krc20HasPrevPage.set(response.prev !== null);
              this.krc20HasNextPage.set(response.next !== null);
            }),
            map((response) => {
              return response.result.map((token) => ({
                ticker: token.tick,
                balance: this.kaspaNetworkActionsService.sompiToNumber(
                  BigInt(+token.balance)
                ),
              }));
            }),
            catchError((err) => {
              console.error(
                `Error fetching token list for address ${wallet.getAddress()}:`,
                err
              );
              this.krc20Error.set('Failed to load KRC20 tokens');
              return of(undefined);
            })
          )
      );

      if (tokens) {
        if (append) {
          // Append new tokens to existing ones
          const currentTokens = this.krc20TokensSubject.getValue() || [];
          this.krc20TokensSubject.next([...currentTokens, ...tokens]);
        } else {
          this.krc20TokensSubject.next(tokens);
        }
        this.updateAllAssets({ krc20: tokens });
      }
    } finally {
      this.krc20IsLoading.set(false);
    }
  }

  /**
   * KNS Asset Methods
   */
  public refreshKnsAssets(wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      // Reset pagination
      this.knsListedPage = 1;
      this.knsNotListedPage = 1;
      // Clear assets for refresh
      this.listedKnsAssetsSubject.next([]);
      this.notListedKnsAssetsSubject.next([]);
      this.loadKnsAssets(currentWallet);
    }
  }

  public loadMoreKnsAssets(status: KnsWalletAssetStatus, wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      if (status === KnsWalletAssetStatus.LISTED) {
        this.knsListedPage++;
      } else {
        this.knsNotListedPage++;
      }
      this.loadKnsAssetsByStatus(currentWallet, status, true); // Always append for load more
    }
  }

  private async loadKnsAssets(wallet: AppWallet): Promise<void> {
    if (!wallet) return;

    this.knsIsLoading.set(true);
    this.knsError.set(null);

    try {
      // Load not listed assets
      await this.loadKnsAssetsByStatus(wallet, KnsWalletAssetStatus.DEFAULT, false);
      
      // Load listed assets
      await this.loadKnsAssetsByStatus(wallet, KnsWalletAssetStatus.LISTED, false);
    } catch (err) {
      console.error(`Error fetching KNS assets for address ${wallet.getAddress()}:`, err);
      this.knsError.set('Failed to load KNS assets');
    } finally {
      this.knsIsLoading.set(false);
    }
  }

  private async loadKnsAssetsByStatus(wallet: AppWallet, status: KnsWalletAssetStatus, append: boolean = false): Promise<void> {
    try {
      const page = status === KnsWalletAssetStatus.LISTED ? this.knsListedPage : this.knsNotListedPage;
      
      const response = await firstValueFrom(
        this.knsApiService.getKnsWalletAssets({
          owner: wallet.getAddress(),
          status: status,
          page: page,
          pageSize: this.knsPageSize
        }).pipe(
          catchError((err) => {
            console.error(`Error fetching KNS assets with status ${status}:`, err);
            return of({ success: false, data: { assets: [], pagination: { currentPage: 1, pageSize: 0, totalItems: 0, totalPages: 0 } } });
          })
        )
      );

      if (status === KnsWalletAssetStatus.LISTED) {
        const assets = response?.data?.assets || [];
        const pagination = response?.data?.pagination;
        
        if (append) {
          const currentAssets = this.listedKnsAssetsSubject.getValue();
          this.listedKnsAssetsSubject.next([...currentAssets, ...assets]);
        } else {
          this.listedKnsAssetsSubject.next(assets);
        }
        
        this.knsListedHasMore.set(pagination ? page < pagination.totalPages : false);
      } else {
        const assets = response?.data?.assets || [];
        const pagination = response?.data?.pagination;
        
        if (append) {
          const currentAssets = this.notListedKnsAssetsSubject.getValue();
          this.notListedKnsAssetsSubject.next([...currentAssets, ...assets]);
        } else {
          this.notListedKnsAssetsSubject.next(assets);
        }
        
        this.knsNotListedHasMore.set(pagination ? page < pagination.totalPages : false);
      }
      this.updateAllAssets({
        knsListed: response?.data?.assets || [],
        knsNotListed: response?.data?.assets || []
      });
    } catch (err) {
      console.error(`Error fetching KNS assets with status ${status}:`, err);
      throw err;
    }
  }

  /**
   * KRC721 Token Methods
   */
  public refreshKrc721Tokens(wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      this.krc721Offset = undefined;
      this.krc721TokensSubject.next([]);
      this.loadKrc721Tokens(currentWallet);
    }
  }
  
  public loadMoreKrc721Tokens(wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      this.loadKrc721Tokens(currentWallet, true);
    }
  }

  private async loadKrc721Tokens(wallet: AppWallet, append: boolean = false): Promise<void> {
    if (!wallet) return;

    this.krc721IsLoading.set(true);
    this.krc721Error.set(null);

    try {
      const response = await firstValueFrom(
        this.krc721ApiService.getWalletAddressTokens(wallet.getAddress(), this.krc721Offset)
          .pipe(
            catchError((err) => {
              console.error(`Error fetching KRC721 assets for address ${wallet.getAddress()}:`, err);
              this.krc721Error.set('Failed to load KRC721 assets');
              return of({ tokens: [], total: 0 });
            })
          )
      );

      if (append) {
        const currentTokens = this.krc721TokensSubject.getValue();
        this.krc721TokensSubject.next([...currentTokens, ...response.tokens]);
      } else {
        this.krc721TokensSubject.next(response.tokens);
      }

      this.krc721HasMore.set(response.total > this.krc721TokensSubject.getValue().length);
      this.krc721Offset = response.tokens[response.tokens.length - 1]?.tokenId;
      this.updateAllAssets({ krc721: response.tokens });
    } finally {
      this.krc721IsLoading.set(false);
    }
  }

  private updateAllAssets(update: Partial<{
    krc20: Krc20Token[] | undefined;
    knsListed: KnsWalletAsset[];
    knsNotListed: KnsWalletAsset[];
    krc721: TokenDetailsResponse[];
  }>): void {
    const current = this.allAssetsSubject.getValue();
    this.allAssetsSubject.next({
      ...current,
      ...update
    });
  }

  /**
   * General refresh method to update all assets
   */
  public refreshAllAssets(wallet?: AppWallet): void {
    const currentWallet = wallet || this.walletService.getCurrentWallet();
    if (currentWallet) {
      this.loadAllAssets(currentWallet);
    }
  }
} 