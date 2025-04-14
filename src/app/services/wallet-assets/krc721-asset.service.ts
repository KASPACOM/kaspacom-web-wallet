import { Injectable } from '@angular/core';
import { BaseAssetService } from './base-asset.service';
import { AppWallet } from '../../classes/AppWallet';
import { Krc721ApiService } from '../krc721-api/krc721-api.service';
import { WalletAddressToken } from '../krc721-api/model/wallet-address-tokens-response.interface';
import { catchError, firstValueFrom, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Krc721AssetService extends BaseAssetService<WalletAddressToken> {
  private tokens: WalletAddressToken[] = [];
  private nextKey: string | undefined;
  private readonly pageSize = 10;

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
      await this.fetchTokens(wallet, undefined);
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading KRC721 tokens:', error);
      this.error.set('Failed to load KRC721 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadNextPage(wallet: AppWallet): Promise<void> {
    if (!wallet || !this.nextKey) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.fetchTokens(wallet, this.nextKey);
      this.updateDataSignal();
    } catch (error) {
      console.error('Error loading next page of KRC721 tokens:', error);
      this.error.set('Failed to load next page of KRC721 tokens');
    } finally {
      this.isLoading.set(false);
    }
  }

  override async loadPreviousPage(wallet: AppWallet): Promise<void> {
    // Previous page functionality removed
    return;
  }

  override reset(): void {
    this.tokens = [];
    this.nextKey = undefined;
    this.data.set({
      data: [],
      totalItems: 0,
      hasNextPage: false,
    });
  }

  private async fetchTokens(wallet: AppWallet, offset: string | undefined): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.krc721ApiService.getWalletAddressTokens(wallet.getAddress(), offset)
          .pipe(
            catchError((err) => {
              console.error(`Error fetching KRC721 tokens for address ${wallet.getAddress()}:`, err);
              return of({ message: '', result: [], next: undefined });
            })
          )
      );

      if (offset) {
        this.tokens = [...this.tokens, ...response.result];
      } else {
        this.tokens = response.result;
      }

      this.nextKey = response.next;

      // Update the data signal with the new tokens
      this.organizeDataIntoPages();
    } catch (err) {
      console.error(`Error fetching KRC721 tokens:`, err);
      throw err;
    }
  }

  private organizeDataIntoPages(): void {
    const pages: WalletAddressToken[][] = [];
    
    for (let i = 0; i < this.tokens.length; i += this.pageSize) {
      pages.push(this.tokens.slice(i, i + this.pageSize));
    }

    this.data.update(current => ({
      ...current,
      data: pages,
      totalItems: this.tokens.length
    }));
  }

  private updateDataSignal(): void {
    this.data.update(current => ({
      ...current,
      hasNextPage: this.nextKey !== undefined
    }));
  }
} 