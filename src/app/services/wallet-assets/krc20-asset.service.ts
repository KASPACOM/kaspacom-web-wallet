import { Injectable } from '@angular/core';
import { BaseAssetService, PagedData } from './base-asset.service';
import { AppWallet } from '../../classes/AppWallet';
import { KaspaNetworkActionsService } from '../kaspa-netwrok-services/kaspa-network-actions.service';
import { KasplexKrc20Service } from '../kasplex-api/kasplex-api.service';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';

export interface Krc20Token {
  ticker: string;
  balance: number;
}

@Injectable({
  providedIn: 'root'
})
export class Krc20AssetService extends BaseAssetService<Krc20Token> {
  private paginationPrevKeys: (string | null)[] = [null];
  private paginationNextKeys: (string | null)[] = [null];
  private currentPage = 0;
  private allTokens: Krc20Token[] = [];

  constructor(
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {
    super();
  }

  override async loadAssets(wallet: AppWallet, refresh = false): Promise<void> {
    if (!wallet) return;

    if (refresh) {
      this.reset();
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.fetchTokens(wallet, null, 'next', false);
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading KRC20 tokens:', error);
      this.error.set('Failed to load KRC20 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadNextPage(wallet: AppWallet): Promise<void> {
    if (!wallet || !this.paginationNextKeys[this.currentPage]) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // If we're not on the last page of our cached data
      if (this.currentPage < this.data().data.length - 1) {
        this.currentPage++;
        this.updateDataSignal();
        return;
      }

      await this.fetchTokens(wallet, this.paginationNextKeys[this.currentPage], 'next', true);
      this.currentPage++;
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading next page of KRC20 tokens:', error);
      this.error.set('Failed to load next page of KRC20 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadPreviousPage(wallet: AppWallet): Promise<void> {
    if (!wallet || this.currentPage === 0) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.currentPage--;
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading previous page of KRC20 tokens:', error);
      this.error.set('Failed to load previous page of KRC20 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override reset(): void {
    this.paginationPrevKeys = [null];
    this.paginationNextKeys = [null];
    this.currentPage = 0;
    this.allTokens = [];
    this.data.set({
      data: [],
      totalItems: 0,
      hasNextPage: false,
    });
  }

  private async fetchTokens(
    wallet: AppWallet,
    paginationKey: string | null,
    direction: 'next' | 'prev',
    append: boolean
  ): Promise<void> {
    const tokens = await firstValueFrom(
      this.kasplexService
        .getWalletTokenList(
          wallet.getAddress(),
          paginationKey,
          direction
        )
        .pipe(
          tap((response) => {
            

            if (append) {
              this.paginationPrevKeys.push(response.prev);
              this.paginationNextKeys.push(response.next);
            } else {
              this.paginationPrevKeys = [response.prev];
              this.paginationNextKeys = [response.next];
            }
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
            this.error.set('Failed to load KRC20 tokens');
            return of([]);
          })
        )
    );

    if (append) {
      // Add as a new page
      this.allTokens = [...this.allTokens, ...tokens];
    } else {
      this.allTokens = tokens;
    }

    // Update the data signal with the new page
    const pageSize = 10; // Adjust the page size as needed
    const pages: Krc20Token[][] = [];
    
    for (let i = 0; i < this.allTokens.length; i += pageSize) {
      pages.push(this.allTokens.slice(i, i + pageSize));
    }

    this.data.update(current => ({
      ...current,
      data: pages,
      totalItems: this.allTokens.length
    }));
  }

  private updateDataSignal(): void {
    this.data.update(current => ({
      ...current,
      hasNextPage: this.paginationNextKeys[this.currentPage] !== null,
      hasPrevPage: this.currentPage > 0
    }));
  }
} 