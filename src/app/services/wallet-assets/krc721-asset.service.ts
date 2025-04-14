import { Injectable } from '@angular/core';
import { BaseAssetService, PagedData } from './base-asset.service';
import { AppWallet } from '../../classes/AppWallet';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { TokenDetailsResponse } from '../../interfaces/krc721-api.interface';
import { catchError, firstValueFrom, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Krc721AssetService extends BaseAssetService<TokenDetailsResponse> {
  private tokens: TokenDetailsResponse[] = [];
  private totalTokens = 0;
  private offset: string | undefined;
  private readonly pageSize = 10;
  private currentPage = 0;

  constructor(private krc721ApiService: Krc721ApiService) {
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
      await this.fetchTokens(wallet, false);
    } catch (error) {
      console.error('Error loading KRC721 tokens:', error);
      this.error.set('Failed to load KRC721 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadNextPage(wallet: AppWallet): Promise<void> {
    if (!wallet || this.tokens.length >= this.totalTokens) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // If we already have this page in our cache
      if (this.currentPage < this.data().data.length - 1) {
        this.currentPage++;
        this.updateDataSignal();
        return;
      }

      await this.fetchTokens(wallet, true);
      this.currentPage++;
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading next page of KRC721 tokens:', error);
      this.error.set('Failed to load next page of KRC721 tokens');
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
      console.error('Error loading previous page of KRC721 tokens:', error);
      this.error.set('Failed to load previous page of KRC721 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override reset(): void {
    this.tokens = [];
    this.totalTokens = 0;
    this.offset = undefined;
    this.currentPage = 0;
    this.data.set({
      data: [],
      totalItems: 0,
      hasNextPage: false,
    });
  }

  private async fetchTokens(wallet: AppWallet, append: boolean): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.krc721ApiService.getWalletAddressTokens(wallet.getAddress(), this.offset)
          .pipe(
            catchError((err) => {
              console.error(`Error fetching KRC721 tokens for address ${wallet.getAddress()}:`, err);
              return of({ tokens: [], total: 0 });
            })
          )
      );

      if (append) {
        this.tokens = [...this.tokens, ...response.tokens];
      } else {
        this.tokens = response.tokens;
      }

      this.totalTokens = response.total;
      this.offset = this.tokens[this.tokens.length - 1]?.tokenId;

      // Update the data signal with the new tokens
      this.organizeDataIntoPages();
    } catch (err) {
      console.error(`Error fetching KRC721 tokens:`, err);
      throw err;
    }
  }

  private organizeDataIntoPages(): void {
    const pages: TokenDetailsResponse[][] = [];
    
    for (let i = 0; i < this.tokens.length; i += this.pageSize) {
      pages.push(this.tokens.slice(i, i + this.pageSize));
    }

    this.data.update(current => ({
      ...current,
      data: pages,
      totalItems: this.totalTokens
    }));
  }

  private updateDataSignal(): void {
    this.data.update(current => ({
      ...current,
      hasNextPage: this.tokens.length < this.totalTokens,
      hasPrevPage: this.currentPage > 0
    }));
  }
} 