import {
  Injectable,
  Signal,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { AppWallet } from '../classes/AppWallet';
import { WalletService } from './wallet.service';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { Krc721ApiService } from './krc721-api/krc721-api.service';
import { KnsApiService } from './kns-api/kns-api.service';
import { TotalBalanceWithUtxosInterface } from '../types/kaspa-network/total-balance-with-utxos.interface';
import {
  GetTokenListDto,
  GetTokenListResponse,
} from './kasplex-api/dtos/token-list-info.dto';
import { Krc721Nft } from './krc721-api/dtos/krc721-nft.dto';
import { KnsDomainAsset } from './kns-api/dtos/kns-domain.dto';
import {
  NetworkSelectionService,
  NetworkType,
} from './network-selection.service';

export interface AssetsLoadingState {
  kaspa: boolean;
  krc20: boolean;
  krc721: boolean;
  kns: boolean;
  l2: boolean;
}

export interface WalletAssets {
  kaspa: TotalBalanceWithUtxosInterface | null;
  krc20: GetTokenListDto[];
  krc721: Krc721Nft[];
  kns: KnsDomainAsset[];
}

export interface AssetTypeTotalValue {
  type: 'kaspa' | 'krc20' | 'krc721' | 'kns';
  totalValue: number;
  count: number;
}

@Injectable({
  providedIn: 'root',
})
export class AssetsStoreService {
  // Signals for assets data
  private kaspaAssetsSignal: WritableSignal<TotalBalanceWithUtxosInterface | null> =
    signal(null);
  private krc20AssetsSignal: WritableSignal<GetTokenListDto[]> = signal([]);
  private krc721AssetsSignal: WritableSignal<Krc721Nft[]> = signal([]);
  private knsAssetsSignal: WritableSignal<KnsDomainAsset[]> = signal([]);

  // Loading states for each asset type
  private loadingStatesSignal: WritableSignal<AssetsLoadingState> = signal({
    kaspa: false,
    krc20: false,
    krc721: false,
    kns: false,
    l2: false,
  });

  // Current wallet
  private currentWallet: AppWallet | undefined;
  private walletSubscription: Subscription | undefined;

  // Auto-reload functionality
  private autoReloadInterval: NodeJS.Timeout | undefined;
  private readonly AUTO_RELOAD_INTERVAL = 5000; // 5 seconds

  // Computed signals for public access
  public readonly kaspaAssets: Signal<TotalBalanceWithUtxosInterface | null> =
    this.kaspaAssetsSignal.asReadonly();
  public readonly krc20Assets: Signal<GetTokenListDto[]> =
    this.krc20AssetsSignal.asReadonly();
  public readonly krc721Assets: Signal<Krc721Nft[]> =
    this.krc721AssetsSignal.asReadonly();
  public readonly knsAssets: Signal<KnsDomainAsset[]> =
    this.knsAssetsSignal.asReadonly();
  public readonly loadingStates: Signal<AssetsLoadingState> =
    this.loadingStatesSignal.asReadonly();

  // Computed signal for all assets
  public readonly allAssets = computed<WalletAssets>(() => ({
    kaspa: this.kaspaAssetsSignal(),
    krc20: this.krc20AssetsSignal(),
    krc721: this.krc721AssetsSignal(),
    kns: this.knsAssetsSignal(),
  }));

  constructor(
    private walletService: WalletService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private kasplexKrc20Service: KasplexKrc20Service,
    private krc721ApiService: Krc721ApiService,
    private knsApiService: KnsApiService,
    private router: Router,
    private networkSelectionService: NetworkSelectionService,
  ) {
    this.initializeWalletListener();
    this.initializeNetworkListener();
  }

  private initializeWalletListener(): void {
    // Subscribe to wallet changes
    this.walletSubscription = toObservable(
      this.walletService.getCurrentWalletSignal(),
    ).subscribe((wallet) => {
      console.log('[AssetsStore] Wallet changed:', wallet?.getIdWithAccount());
      this.onWalletChanged(wallet);
    });

    // Load assets for current wallet if available
    const currentWallet = this.walletService.getCurrentWallet();
    if (currentWallet) {
      this.onWalletChanged(currentWallet);
    }
  }

  private initializeNetworkListener(): void {
    // Subscribe to network changes
    toObservable(
      this.networkSelectionService.getCurrentNetworkSignal(),
    ).subscribe((network) => {
      console.log('[AssetsStore] Network changed:', network);
      this.onNetworkChanged(network);
    });
  }

  private onNetworkChanged(network: NetworkType): void {
    // Reload assets when network changes
    if (this.currentWallet) {
      console.log('[AssetsStore] Reloading assets for network:', network);
      this.reloadAll();
    }
  }

  private async onWalletChanged(wallet: AppWallet | undefined): Promise<void> {
    if (wallet?.getIdWithAccount() !== this.currentWallet?.getIdWithAccount()) {
      // Stop auto-reload for previous wallet
      this.stopAutoReload();

      // Clear previous assets
      this.clearAllAssets();

      this.currentWallet = wallet;

      if (wallet) {
        console.log(
          '[AssetsStore] Loading assets for wallet:',
          wallet.getIdWithAccount(),
        );

        // Navigate to homepage when wallet account changes
        if (this.router.url.startsWith('/app/')) {
          this.router.navigate(['/app/home']);
        }

        await this.reloadAll();
        // Start auto-reload for new wallet
        this.startAutoReload();
      } else {
        // If wallet is null, navigate to appropriate page
        this.router.navigate(['/']);
      }
    }
  }

  private clearAllAssets(): void {
    this.kaspaAssetsSignal.set(null);
    this.krc20AssetsSignal.set([]);
    this.krc721AssetsSignal.set([]);
    this.knsAssetsSignal.set([]);
  }

  private startAutoReload(): void {
    if (this.autoReloadInterval) {
      clearInterval(this.autoReloadInterval);
    }

    console.log(
      '[AssetsStore] Starting auto-reload every',
      this.AUTO_RELOAD_INTERVAL,
      'ms',
    );
    this.autoReloadInterval = setInterval(() => {
      if (this.currentWallet) {
        console.log('[AssetsStore] Auto-reloading assets...');
        this.reloadAllSilent();
      }
    }, this.AUTO_RELOAD_INTERVAL);
  }

  private stopAutoReload(): void {
    if (this.autoReloadInterval) {
      console.log('[AssetsStore] Stopping auto-reload');
      clearInterval(this.autoReloadInterval);
      this.autoReloadInterval = undefined;
    }
  }

  // Public methods

  /**
   * Reload all asset types
   */
  public async reloadAll(delay = 0): Promise<void> {
    if (!this.currentWallet) {
      console.log('[AssetsStore] No wallet selected, skipping reload');
      return;
    }

    console.log('[AssetsStore] Reloading all assets');

    const currentNetwork = this.networkSelectionService.getCurrentNetwork();

    // Load assets based on network type
    if (currentNetwork === 'l1-kaspa') {
      // Load all L1 assets in parallel with individual delays
      await Promise.all([
        this.reloadKaspa(delay),
        this.reloadKrc20(delay),
        this.reloadKrc721(delay),
        this.reloadKns(delay),
      ]);
    } else if (currentNetwork === 'kasplex') {
      // Load L2 Kasplex assets (ERC20 tokens)
      await Promise.all([this.reloadL2Assets(delay)]);
    } else if (currentNetwork === 'igra') {
      // Igra network is disabled for now
      console.log('[AssetsStore] Igra network is disabled');
    }
  }

  /**
   * Reload all asset types without showing loading states (silent reload)
   */
  public async reloadAllSilent(delay = 0): Promise<void> {
    if (!this.currentWallet) {
      console.log('[AssetsStore] No wallet selected, skipping silent reload');
      return;
    }

    console.log('[AssetsStore] Silent reloading all assets');

    const currentNetwork = this.networkSelectionService.getCurrentNetwork();

    // Load assets based on network type
    if (currentNetwork === 'l1-kaspa') {
      // Load all L1 assets in parallel with individual delays, without loading states
      await Promise.all([
        this.reloadKaspaSilent(delay),
        this.reloadKrc20Silent(delay),
        this.reloadKrc721Silent(delay),
        this.reloadKnsSilent(delay),
      ]);
    } else if (currentNetwork === 'kasplex') {
      // Load L2 Kasplex assets (ERC20 tokens)
      await Promise.all([this.reloadL2AssetsSilent(delay)]);
    } else if (currentNetwork === 'igra') {
      // Igra network is disabled for now
      console.log('[AssetsStore] Igra network is disabled');
    }
  }

  /**
   * Reload Kaspa (TKAS) balance
   */
  public async reloadKaspa(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    this.setLoadingState('kaspa', true);
    console.log('[AssetsStore] Loading Kaspa balance...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const balance =
            await this.kaspaNetworkActionsService.getWalletBalanceAndUtxos(
              this.currentWallet!.getAddress(),
            );
          this.kaspaAssetsSignal.set(balance);
          console.log('[AssetsStore] Kaspa balance loaded:', {
            totalBalance: this.kaspaNetworkActionsService.sompiToNumber(
              balance.totalBalance,
            ),
            utxoCount: balance.utxoEntries.length,
          });
        } catch (error) {
          console.error('[AssetsStore] Error loading Kaspa balance:', error);
          this.kaspaAssetsSignal.set(null);
        } finally {
          this.setLoadingState('kaspa', false);
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KRC20 tokens with pagination
   */
  public async reloadKrc20(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    this.setLoadingState('krc20', true);
    console.log('[AssetsStore] Loading KRC20 tokens...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const allTokens: GetTokenListDto[] = [];
          let paginationKey: string | null = null;
          let pageCount = 0;

          // Load all pages
          do {
            const response: GetTokenListResponse = await firstValueFrom(
              this.kasplexKrc20Service.getWalletTokenList(
                this.currentWallet!.getAddress(),
                paginationKey,
                paginationKey ? 'next' : null,
              ),
            );

            if (response.result && response.result.length > 0) {
              const tokens: GetTokenListDto[] = response.result.map(
                (token) => ({
                  tick: token.tick,
                  balance:
                    parseFloat(token.balance) /
                    Math.pow(10, parseInt(token.dec)),
                  locked:
                    parseFloat(token.locked) /
                    Math.pow(10, parseInt(token.dec)),
                  decimals: parseInt(token.dec),
                  opScoreMod: token.opScoreMod,
                }),
              );

              allTokens.push(...tokens);
              pageCount++;
              console.log(
                `[AssetsStore] Loaded KRC20 page ${pageCount}, tokens:`,
                tokens.length,
              );
            }

            paginationKey = response.next;
          } while (paginationKey);

          this.krc20AssetsSignal.set(allTokens);
          console.log('[AssetsStore] KRC20 tokens loaded:', {
            totalTokens: allTokens.length,
            pages: pageCount,
          });
        } catch (error) {
          console.error('[AssetsStore] Error loading KRC20 tokens:', error);
          this.krc20AssetsSignal.set([]);
        } finally {
          this.setLoadingState('krc20', false);
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KRC721 NFTs
   */
  public async reloadKrc721(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    this.setLoadingState('krc721', true);
    console.log('[AssetsStore] Loading KRC721 NFTs...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Call API without pagination parameters (like the original implementation)
          const response = await firstValueFrom(
            this.krc721ApiService.getAddressNfts(
              this.currentWallet!.getAddress(),
            ),
          );

          if (response.message === 'success' && response.result) {
            this.krc721AssetsSignal.set(response.result);
            console.log('[AssetsStore] KRC721 NFTs loaded:', {
              totalNfts: response.result.length,
            });
          } else {
            console.warn(
              '[AssetsStore] KRC721 API response not successful:',
              response,
            );
            this.krc721AssetsSignal.set([]);
          }
        } catch (error) {
          console.error('[AssetsStore] Error loading KRC721 NFTs:', error);
          this.krc721AssetsSignal.set([]);
        } finally {
          this.setLoadingState('krc721', false);
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KNS domains with pagination
   */
  public async reloadKns(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    this.setLoadingState('kns', true);
    console.log('[AssetsStore] Loading KNS domains...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const allDomains = await this.knsApiService.getAllWalletDomains(
            this.currentWallet!.getAddress(),
          );

          this.knsAssetsSignal.set(allDomains);
          console.log('[AssetsStore] KNS domains loaded:', {
            totalDomains: allDomains.length,
          });
        } catch (error) {
          console.error('[AssetsStore] Error loading KNS domains:', error);
          this.knsAssetsSignal.set([]);
        } finally {
          this.setLoadingState('kns', false);
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload Kaspa (TKAS) balance without loading state
   */
  public async reloadKaspaSilent(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const balance =
            await this.kaspaNetworkActionsService.getWalletBalanceAndUtxos(
              this.currentWallet!.getAddress(),
            );
          this.kaspaAssetsSignal.set(balance);
          console.log('[AssetsStore] Kaspa balance silently loaded:', {
            totalBalance: this.kaspaNetworkActionsService.sompiToNumber(
              balance.totalBalance,
            ),
            utxoCount: balance.utxoEntries.length,
          });
        } catch (error) {
          console.error(
            '[AssetsStore] Error silently loading Kaspa balance:',
            error,
          );
          this.kaspaAssetsSignal.set(null);
        } finally {
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KRC20 tokens without loading state
   */
  public async reloadKrc20Silent(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const allTokens: GetTokenListDto[] = [];
          let paginationKey: string | null = null;
          let pageCount = 0;

          // Load all pages
          do {
            const response: GetTokenListResponse = await firstValueFrom(
              this.kasplexKrc20Service.getWalletTokenList(
                this.currentWallet!.getAddress(),
                paginationKey,
                paginationKey ? 'next' : null,
              ),
            );

            if (response.result && response.result.length > 0) {
              const tokens: GetTokenListDto[] = response.result.map(
                (token) => ({
                  tick: token.tick,
                  balance:
                    parseFloat(token.balance) /
                    Math.pow(10, parseInt(token.dec)),
                  locked:
                    parseFloat(token.locked) /
                    Math.pow(10, parseInt(token.dec)),
                  decimals: parseInt(token.dec),
                  opScoreMod: token.opScoreMod,
                }),
              );

              allTokens.push(...tokens);
              pageCount++;
            }

            paginationKey = response.next;
          } while (paginationKey);

          this.krc20AssetsSignal.set(allTokens);
          console.log('[AssetsStore] KRC20 tokens silently loaded:', {
            totalTokens: allTokens.length,
            pages: pageCount,
          });
        } catch (error) {
          console.error(
            '[AssetsStore] Error silently loading KRC20 tokens:',
            error,
          );
          this.krc20AssetsSignal.set([]);
        } finally {
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KRC721 NFTs without loading state
   */
  public async reloadKrc721Silent(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const response = await firstValueFrom(
            this.krc721ApiService.getAddressNfts(
              this.currentWallet!.getAddress(),
            ),
          );

          if (response.message === 'success' && response.result) {
            this.krc721AssetsSignal.set(response.result);
            console.log('[AssetsStore] KRC721 NFTs silently loaded:', {
              totalNfts: response.result.length,
            });
          } else {
            console.warn(
              '[AssetsStore] KRC721 API response not successful (silent):',
              response,
            );
            this.krc721AssetsSignal.set([]);
          }
        } catch (error) {
          console.error(
            '[AssetsStore] Error silently loading KRC721 NFTs:',
            error,
          );
          this.krc721AssetsSignal.set([]);
        } finally {
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload KNS domains without loading state
   */
  public async reloadKnsSilent(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const allDomains = await this.knsApiService.getAllWalletDomains(
            this.currentWallet!.getAddress(),
          );

          this.knsAssetsSignal.set(allDomains);
          console.log('[AssetsStore] KNS domains silently loaded:', {
            totalDomains: allDomains.length,
          });
        } catch (error) {
          console.error(
            '[AssetsStore] Error silently loading KNS domains:',
            error,
          );
          this.knsAssetsSignal.set([]);
        } finally {
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Get all assets of a specific type
   */
  public getAssetsByType<T extends keyof WalletAssets>(
    type: T,
  ): WalletAssets[T] {
    const assets = this.allAssets();
    return assets[type];
  }

  /**
   * Get all asset types with their values
   */
  public getAllAssetValues(): AssetTypeTotalValue[] {
    const assets = this.allAssets();
    const values: AssetTypeTotalValue[] = [];

    // Kaspa value
    if (assets.kaspa) {
      const kasValue = this.kaspaNetworkActionsService.sompiToNumber(
        assets.kaspa.totalBalance,
      );
      values.push({
        type: 'kaspa',
        totalValue: kasValue,
        count: 1,
      });
    }

    // KRC20 values (Note: we'd need price data to calculate actual values)
    if (assets.krc20.length > 0) {
      values.push({
        type: 'krc20',
        totalValue: 0, // Would need price data
        count: assets.krc20.length,
      });
    }

    // KRC721 values (Note: we'd need floor price data)
    if (assets.krc721.length > 0) {
      values.push({
        type: 'krc721',
        totalValue: 0, // Would need floor price data
        count: assets.krc721.length,
      });
    }

    // KNS values (Note: we'd need market data)
    if (assets.kns.length > 0) {
      values.push({
        type: 'kns',
        totalValue: 0, // Would need market data
        count: assets.kns.length,
      });
    }

    return values;
  }

  /**
   * Check if a specific asset type is loading
   */
  public isAssetTypeLoading(type: keyof AssetsLoadingState): boolean {
    return this.loadingStates()[type];
  }

  /**
   * Check if any asset type is loading
   */
  public isAnyAssetLoading(): boolean {
    const states = this.loadingStates();
    return Object.values(states).some((loading) => loading);
  }

  private setLoadingState(
    type: keyof AssetsLoadingState,
    loading: boolean,
  ): void {
    this.loadingStatesSignal.update((states) => ({
      ...states,
      [type]: loading,
    }));
    console.log(`[AssetsStore] Loading state for ${type}:`, loading);
  }

  /**
   * Reload L2 assets (for Kasplex ERC20 tokens)
   */
  public async reloadL2Assets(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    this.setLoadingState('l2', true);
    console.log('[AssetsStore] Loading L2 assets...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Actually refresh the L2 balance by calling refreshL2Balance
          // This ensures fresh balance data instead of cached values
          await this.currentWallet!.refreshL2Balance();

          const wallet = this.currentWallet!;
          const l2State = wallet.getL2WalletStateSignal()();

          if (l2State) {
            // Set L2 balance as kaspa assets for display purposes
            const mockL2Balance: TotalBalanceWithUtxosInterface = {
              totalBalance: BigInt(Math.floor(l2State.balanceFormatted * 1e8)), // Convert to sompi
              utxoEntries: [],
            };
            this.kaspaAssetsSignal.set(mockL2Balance);
            console.log(
              '[AssetsStore] L2 balance loaded:',
              l2State.balanceFormatted,
            );
          } else {
            this.kaspaAssetsSignal.set(null);
          }

          // Clear other asset types for L2
          this.krc20AssetsSignal.set([]);
          this.krc721AssetsSignal.set([]);
          this.knsAssetsSignal.set([]);
        } catch (error) {
          console.error('[AssetsStore] Error loading L2 assets:', error);
          this.kaspaAssetsSignal.set(null);
          this.krc20AssetsSignal.set([]);
          this.krc721AssetsSignal.set([]);
          this.knsAssetsSignal.set([]);
        } finally {
          this.setLoadingState('l2', false);
          resolve(undefined);
        }
      }, delay);
    });
  }

  /**
   * Reload L2 assets without showing loading states (silent reload)
   */
  public async reloadL2AssetsSilent(delay = 0): Promise<void> {
    if (!this.currentWallet) return;

    console.log('[AssetsStore] Silent reloading L2 assets...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Actually refresh the L2 balance by calling refreshL2Balance
          // This ensures fresh balance data instead of cached values during periodic refresh
          await this.currentWallet!.refreshL2Balance();

          const wallet = this.currentWallet!;
          const l2State = wallet.getL2WalletStateSignal()();

          if (l2State) {
            const mockL2Balance: TotalBalanceWithUtxosInterface = {
              totalBalance: BigInt(Math.floor(l2State.balanceFormatted * 1e8)),
              utxoEntries: [],
            };
            this.kaspaAssetsSignal.set(mockL2Balance);
            console.log(
              '[AssetsStore] L2 balance silently refreshed:',
              l2State.balanceFormatted,
            );
          } else {
            this.kaspaAssetsSignal.set(null);
          }

          // Clear other asset types for L2
          this.krc20AssetsSignal.set([]);
          this.krc721AssetsSignal.set([]);
          this.knsAssetsSignal.set([]);
        } catch (error) {
          console.error(
            '[AssetsStore] Error loading L2 assets silently:',
            error,
          );
          this.kaspaAssetsSignal.set(null);
          this.krc20AssetsSignal.set([]);
          this.krc721AssetsSignal.set([]);
          this.knsAssetsSignal.set([]);
        } finally {
          resolve(undefined);
        }
      }, delay);
    });
  }

  ngOnDestroy(): void {
    this.walletSubscription?.unsubscribe();
    this.stopAutoReload();
  }
}
