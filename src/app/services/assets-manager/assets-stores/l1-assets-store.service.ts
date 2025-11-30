import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import { BaseAssetsStoreService, BaseAssetStoreData } from "./base-assets-store.service";
import { GetTokenListDto, GetTokenListResponse } from "../../kasplex-api/dtos/token-list-info.dto";
import { Krc721Nft } from "../../krc721-api/dtos/krc721-nft.dto";
import { Krc721PortfolioItem } from "../../krc721-api/dtos/krc721-portfolio.dto";
import { KnsDomainAsset } from "../../kns-api/dtos/kns-domain.dto";
import { firstValueFrom } from "rxjs";
import { KasplexKrc20Service } from "../../kasplex-api/kasplex-api.service";
import { Krc721ApiService } from "../../krc721-api/krc721-api.service";
import { KnsApiService } from "../../kns-api/kns-api.service";
import { KaspaComApiService } from "../../kaspacom-api/kaspacom-api.service";
import { L1AssetType } from "../enums/l1-asset-type.enum";
import { L1_PAGINATION_CONFIG } from "../interfaces/pagination-state.interface";
import _ from 'lodash';

export const L1_ASSET_KEYS = {
    krc20: 'krc20',
    krc721: 'krc721',
    kns: 'kns',
}

export interface L1AssetStoreData extends BaseAssetStoreData {
    [L1_ASSET_KEYS.krc20]: GetTokenListDto;
    [L1_ASSET_KEYS.krc721]: Krc721Nft;
    [L1_ASSET_KEYS.kns]: KnsDomainAsset;
}

/**
 * Interface for loadMore results
 */
interface LoadMoreStoreResult {
    success: boolean;
    itemsAdded: number;
    hasMore: boolean;
    nextCursor: number | string | undefined;
    error?: string;
}

@Injectable({
    providedIn: 'root',
})
export class L1AssetsStoreService extends BaseAssetsStoreService<L1AssetStoreData> {
    protected kasplexKrc20Service = inject(KasplexKrc20Service);
    protected krc721ApiService = inject(Krc721ApiService);
    protected knsApiService = inject(KnsApiService);
    protected kaspacomApiService = inject(KaspaComApiService);

    // Pagination state for KRC721
    private krc721NextCursor: WritableSignal<number | undefined> = signal(undefined);
    private krc721HasMore: WritableSignal<boolean> = signal(true);
    private krc721LoadedPages: WritableSignal<number> = signal(0); // Track pages loaded

    // New internal state for Portfolio API
    private krc721PortfolioSummary: Krc721PortfolioItem[] = [];
    private krc721PortfolioIndex = 0;
    private krc721TokenQueue: Krc721Nft[] = [];
    private krc721CollectionCache = new Map<string, number>(); // tick -> totalSupply
    
    private readonly KRC721_PAGE_SIZE = L1_PAGINATION_CONFIG.krc721.pageSize;
    
    // Pagination state for KNS (page-based)
    private knsCurrentPage: WritableSignal<number> = signal(1);
    private knsTotalPages: WritableSignal<number> = signal(1);
    private knsHasMore: WritableSignal<boolean> = signal(true);
    private knsLoadedPages: WritableSignal<number> = signal(0); // Track pages loaded
    
    private readonly KNS_PAGE_SIZE = L1_PAGINATION_CONFIG.kns.pageSize;
    
    // Pagination state for KRC20 (cursor-based)
    private krc20NextCursor: WritableSignal<string | null | undefined> = signal(undefined);
    private krc20HasMore: WritableSignal<boolean> = signal(true);
    private krc20LoadedPages: WritableSignal<number> = signal(0); // Track pages loaded
    
    private readonly KRC20_PAGE_SIZE = L1_PAGINATION_CONFIG.krc20.pageSize;

    constructor() {
        super();
    }

    protected override getLoadFunctionAssetsNames(): { [K in keyof L1AssetStoreData]: string } {
        return {
            kns: 'getKnsInfo',
            krc20: 'getKrc20Info',
            krc721: 'getKrc721Info',
        }
    }

    /**
     * Load initial KRC20 tokens (first page only)
     * Smart auto-reload: Fetches as many items as user has already loaded
     */
    protected async getKrc20Info(walletAddress: string): Promise<GetTokenListDto[]> {
        const existingData = this.data['krc20']() as GetTokenListDto[] | undefined;
        const isAutoReload = existingData !== undefined && existingData.length > 0;
        
        if (isAutoReload) {
            // Smart fetch: Get as many items as user has loaded (doesn't fetch ALL tokens)
            const itemsToFetch = existingData.length;
            const pagesToFetch = this.krc20LoadedPages();
            
            // KRC20 API returns all tokens in one call, so we just fetch once
            const response: GetTokenListResponse = await firstValueFrom(
                this.kasplexKrc20Service.getWalletTokenList(
                    walletAddress,
                    null,
                    null,
                ),
            );
            
            if (response.result && response.result.length > 0) {
                const freshTokens: GetTokenListDto[] = response.result.map(
                    (token) => ({
                        tick: token.tick,
                        balance: parseFloat(token.balance) / Math.pow(10, parseInt(token.dec)),
                        locked: parseFloat(token.locked) / Math.pow(10, parseInt(token.dec)),
                        decimals: parseInt(token.dec),
                        opScoreMod: token.opScoreMod,
                        priceKas: 0,
                    }),
                );
                
                // Fetch prices for all tokens
                try {
                    const prices = await this.kaspacomApiService.getTokensPrices(
                        freshTokens.map(token => token.tick),
                    );
                    const pricesByTicker = _.keyBy(prices, 'ticker');
                    freshTokens.forEach(token => {
                        token.priceKas = pricesByTicker[token.tick]?.price || 0;
                    });
                } catch (error) {
                    console.error('Error fetching token prices during auto-reload:', error);
                }
                
                // Smart merge with deduplication
                const { merged, newItems, removedCount } = this.mergeKrc20Data(existingData, freshTokens);
                
                // Update cursor to last item BEFORE new items (maintains pagination continuity)
                const lastOriginalIndex = merged.length - newItems.length - 1;
                if (lastOriginalIndex >= 0 && merged[lastOriginalIndex]) {
                    // KRC20 uses tick as cursor
                    this.krc20NextCursor.set(merged[lastOriginalIndex].tick);
                }
                
                // If new items found, set hasMore to true (more might exist beyond)
                if (newItems.length > 0) {
                    this.krc20HasMore.set(true);
                }
                
                return merged;
            } else {
                return existingData;
            }
        } else {
            // Initial load: Reset pagination state
            this.krc20NextCursor.set(undefined);
            this.krc20HasMore.set(true);
            this.krc20LoadedPages.set(1); // Track initial page
            
            // Load first page only
            const response: GetTokenListResponse = await firstValueFrom(
                this.kasplexKrc20Service.getWalletTokenList(
                    walletAddress,
                    null, // No cursor for first page
                    null,
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
                        priceKas: 0,
                    }),
                );

                // Update pagination state
                this.krc20NextCursor.set(response.next);
                this.krc20HasMore.set(!!response.next);

                // Fetch prices for initial batch
                try {
                    const prices = await this.kaspacomApiService.getTokensPrices(
                        tokens.map(token => token.tick),
                    );

                    const pricesByTicker = _.keyBy(prices, 'ticker');
                    tokens.forEach(token => {
                        token.priceKas = pricesByTicker[token.tick]?.price || 0;
                    });
                } catch (error) {
                    console.error('Error fetching token prices:', error);
                }

                return tokens;
            }

            return [];
        }
    }
    
    /**
     * Merge existing KRC20 data with fresh data from auto-reload
     * Strategy: Update existing items ONLY if changed, add NEW items at BOTTOM, remove deleted ones
     * IMPORTANT: Preserves existing objects when data unchanged to prevent unnecessary re-renders
     * Returns: { merged, newItems, removedCount }
     */
    private mergeKrc20Data(
        existing: GetTokenListDto[], 
        fresh: GetTokenListDto[]
    ): { merged: GetTokenListDto[], newItems: GetTokenListDto[], removedCount: number } {
        
        // Build maps for O(1) lookup (case-insensitive for ticks)
        const existingMap = new Map<string, GetTokenListDto>();
        existing.forEach(token => {
            existingMap.set(token.tick.toLowerCase(), token);
        });
        
        const freshMap = new Map<string, GetTokenListDto>();
        fresh.forEach(token => {
            freshMap.set(token.tick.toLowerCase(), token);
        });
        
        // Step 1: Update existing tokens (preserve order AND object references when possible)
        const updated: GetTokenListDto[] = [];
        let removedCount = 0;
        
        for (const token of existing) {
            const key = token.tick.toLowerCase();
            
            if (freshMap.has(key)) {
                const freshToken = freshMap.get(key)!;
                
                // CRITICAL: Only replace object if balance/price actually changed
                // This prevents unnecessary re-renders
                const hasChanged = this.hasKrc20TokenChanged(token, freshToken);
                
                if (hasChanged) {
                    // Data changed - use fresh object
                    updated.push(freshToken);
                } else {
                    // Data identical - KEEP existing object (prevents re-render flicker)
                    updated.push(token);
                }
                
                freshMap.delete(key); // Mark as processed
            } else {
                // No longer owned - token was sent/sold
                removedCount++;
            }
        }
        
        // Step 2: Identify NEW tokens (in fresh but not in existing)
        const newItems: GetTokenListDto[] = Array.from(freshMap.values());
        
        // Step 3: Append new tokens to BOTTOM (non-disruptive to user)
        const merged = [...updated, ...newItems];
        
        return { merged, newItems, removedCount };
    }
    
    /**
     * Check if KRC20 token data has actually changed
     * Used to avoid replacing objects unnecessarily (which would trigger re-renders)
     */
    private hasKrc20TokenChanged(existing: GetTokenListDto, fresh: GetTokenListDto): boolean {
        // Compare key properties that matter for display
        // Use small epsilon for price comparison (floating point precision)
        const PRICE_EPSILON = 0.000001;
        
        return existing.tick !== fresh.tick ||
               Math.abs(existing.balance - fresh.balance) > PRICE_EPSILON ||
               Math.abs(existing.locked - fresh.locked) > PRICE_EPSILON ||
               Math.abs(existing.priceKas - fresh.priceKas) > PRICE_EPSILON ||
               existing.decimals !== fresh.decimals;
    }
    
    /**
     * Load more KRC20 tokens (next page)
     * Called by Krc20ListService when scrolling
     */
    async loadMoreKrc20Tokens(): Promise<LoadMoreStoreResult> {
        const cursor = this.krc20NextCursor();
        const hasMore = this.krc20HasMore();
        
        if (!hasMore || !cursor) {
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined
            };
        }
        
        try {
            const walletAddress = await this.getWalletAddress();
            
            const response: GetTokenListResponse = await firstValueFrom(
                this.kasplexKrc20Service.getWalletTokenList(
                    walletAddress,
                    cursor,
                    'next',
                ),
            );
            
            if (response.result && response.result.length > 0) {
                const newTokens: GetTokenListDto[] = response.result.map(
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
                        priceKas: 0,
                    }),
                );
                
                // Fetch prices for new batch
        try {
            const prices = await this.kaspacomApiService.getTokensPrices(
                        newTokens.map(token => token.tick),
            );

            const pricesByTicker = _.keyBy(prices, 'ticker');
                    newTokens.forEach(token => {
                token.priceKas = pricesByTicker[token.tick]?.price || 0;
            });
        } catch (error) {
            console.error('Error fetching token prices:', error);
        }

                // Append to existing data
                const currentTokens = this.data[L1_ASSET_KEYS.krc20]() || [];
                this.data[L1_ASSET_KEYS.krc20].set([...currentTokens, ...newTokens]);
                
                // Update pagination state
                this.krc20NextCursor.set(response.next);
                this.krc20HasMore.set(!!response.next);
                this.krc20LoadedPages.update(p => p + 1); // Track pages loaded
                
                return {
                    success: true,
                    itemsAdded: newTokens.length,
                    hasMore: this.krc20HasMore(),
                    nextCursor: response.next ?? undefined
                };
            }
            
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined,
                error: 'No tokens in response'
            };
        } catch (error) {
            console.error('Error loading more KRC20 tokens:', error);
            return {
                success: false,
                itemsAdded: 0,
                hasMore: hasMore,
                nextCursor: cursor ?? undefined,
                error: (error as Error).message
            };
        }
    }

    /**
     * Load initial KRC721 NFTs (first page only)
     * Uses new Portfolio API
     */
    protected async getKrc721Info(walletAddress: string): Promise<Krc721Nft[]> {
        // Reset internal state for fresh load
        this.krc721PortfolioSummary = [];
        this.krc721PortfolioIndex = 0;
        this.krc721TokenQueue = [];
        this.krc721CollectionCache.clear(); 

        try {
            // 1. Fetch summary
            this.krc721PortfolioSummary = await firstValueFrom(this.krc721ApiService.getPortfolio(walletAddress));
        } catch (e) {
            console.error('Error fetching portfolio summary', e);
            this.krc721PortfolioSummary = [];
        }

        // 2. Fetch first batch
        const nfts = await this.fetchNextKrc721Batch(walletAddress);
        
        // Update pagination
        this.krc721NextCursor.set(this.krc721PortfolioIndex);
        this.krc721HasMore.set(this.krc721PortfolioIndex < this.krc721PortfolioSummary.length || this.krc721TokenQueue.length > 0);
        this.krc721LoadedPages.set(1);
        
        return nfts;
    }
    
    /**
     * Merge existing KRC721 data with fresh data from auto-reload
     * Strategy: Update existing items ONLY if changed, add NEW items at BOTTOM, remove deleted ones
     * IMPORTANT: Preserves existing objects when data unchanged to prevent metadata re-fetching
     * Returns: { merged, newItems, removedCount }
     */
    private mergeKrc721Data(
        existing: Krc721Nft[], 
        fresh: Krc721Nft[]
    ): { merged: Krc721Nft[], newItems: Krc721Nft[], removedCount: number } {
        
        // Build maps for O(1) lookup
        const existingMap = new Map<string, Krc721Nft>();
        existing.forEach(nft => {
            const id = `${nft.tick}_${nft.tokenId}`;
            existingMap.set(id, nft);
        });
        
        const freshMap = new Map<string, Krc721Nft>();
        fresh.forEach(nft => {
            const id = `${nft.tick}_${nft.tokenId}`;
            freshMap.set(id, nft);
        });
        
        // Step 1: Update existing NFTs (preserve order AND object references when possible)
        const updated: Krc721Nft[] = [];
        let removedCount = 0;
        
        for (const nft of existing) {
            const id = `${nft.tick}_${nft.tokenId}`;
            
            if (freshMap.has(id)) {
                const freshNft = freshMap.get(id)!;
                
                // CRITICAL: Only replace object if data actually changed
                // This prevents metadata service from re-fetching unchanged NFTs
                const hasChanged = this.hasKrc721NftChanged(nft, freshNft);
                
                if (hasChanged) {
                    // Data changed - use fresh object
                    updated.push(freshNft);
                } else {
                    // Data identical - KEEP existing object (preserves metadata cache)
                    updated.push(nft);
                }
                
                freshMap.delete(id); // Mark as processed
            } else {
                // No longer owned - NFT was sent/sold
                removedCount++;
            }
        }
        
        // Step 2: Identify NEW NFTs (in fresh but not in existing)
        const newItems: Krc721Nft[] = Array.from(freshMap.values());
        
        // Step 3: Append new NFTs to BOTTOM (non-disruptive to user)
        const merged = [...updated, ...newItems];
        
        return { merged, newItems, removedCount };
    }
    
    /**
     * Check if KRC721 NFT data has actually changed
     * Used to avoid replacing objects unnecessarily (which would trigger metadata re-fetch)
     */
    private hasKrc721NftChanged(existing: Krc721Nft, fresh: Krc721Nft): boolean {
        // Compare key properties that matter for display
        // For NFTs, these rarely change unless transferred or metadata updated
        // Available properties: tick, tokenId, owner, buri?, metadata?
        return existing.tick !== fresh.tick ||
               existing.tokenId !== fresh.tokenId ||
               existing.owner !== fresh.owner ||
               existing.buri !== fresh.buri ||
               JSON.stringify(existing.metadata) !== JSON.stringify(fresh.metadata);
    }
    
    /**
     * Merge KNS domain data intelligently
     * - Preserves existing object references if data hasn't changed (avoids re-renders)
     * - Removes domains no longer in fresh data
     * - Adds new domains to the bottom
     */
    private mergeKnsData(
        existing: KnsDomainAsset[], 
        fresh: KnsDomainAsset[]
    ): { merged: KnsDomainAsset[], newItems: KnsDomainAsset[], removedCount: number } {
        
        // Use Map for efficient lookup by domain ID
        const existingMap = new Map<string, KnsDomainAsset>();
        existing.forEach(domain => {
            existingMap.set(domain.id, domain);
        });
        
        const freshMap = new Map<string, KnsDomainAsset>();
        fresh.forEach(domain => {
            freshMap.set(domain.id, domain);
        });
        
        // Build updated list: iterate existing, update if in fresh
        const updated: KnsDomainAsset[] = [];
        let removedCount = 0;
        
        for (const domain of existing) {
            const id = domain.id;
            
            if (freshMap.has(id)) {
                const freshDomain = freshMap.get(id)!;
                
                // Check if data actually changed
                const hasChanged = this.hasKnsDomainChanged(domain, freshDomain);
                
                if (hasChanged) {
                    // Data changed, use fresh object
                    updated.push(freshDomain);
                } else {
                    // No change, keep existing object (preserves references)
                    updated.push(domain);
                }
                
                // Remove from fresh map to track new items
                freshMap.delete(id);
            } else {
                // Domain no longer exists (removed/transferred)
                removedCount++;
            }
        }
        
        // Remaining items in freshMap are NEW domains
        const newItems: KnsDomainAsset[] = Array.from(freshMap.values());
        
        // Add new items to BOTTOM of list
        const merged = [...updated, ...newItems];
        
        return { merged, newItems, removedCount };
    }
    
    /**
     * Check if KNS domain data has actually changed
     * Used to avoid replacing objects unnecessarily (which would trigger re-renders)
     */
    private hasKnsDomainChanged(existing: KnsDomainAsset, fresh: KnsDomainAsset): boolean {
        // Compare key properties that matter for display
        // For domains, these rarely change unless transferred or status updated
        return existing.id !== fresh.id ||
               existing.assetId !== fresh.assetId ||
               existing.owner !== fresh.owner ||
               existing.status !== fresh.status ||
               existing.isVerifiedDomain !== fresh.isVerifiedDomain;
    }
    
    /**
     * Load more KRC721 NFTs (next page)
     * Called by Krc721ListService when scrolling
     */
    async loadMoreKrc721Nfts(): Promise<LoadMoreStoreResult> {
        if (!this.krc721HasMore()) {
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined
            };
        }
        
        try {
            const walletAddress = await this.getWalletAddress();
            const newNfts = await this.fetchNextKrc721Batch(walletAddress);
            
            if (newNfts.length > 0) {
                // Append to existing data
                const currentNfts = this.data[L1_ASSET_KEYS.krc721]() || [];
                // Use set to update signal
                this.data[L1_ASSET_KEYS.krc721].set([...currentNfts, ...newNfts]);
                
                // Update pagination state
                this.krc721HasMore.set(this.krc721PortfolioIndex < this.krc721PortfolioSummary.length || this.krc721TokenQueue.length > 0);
                this.krc721NextCursor.set(this.krc721PortfolioIndex);
                this.krc721LoadedPages.update(p => p + 1);
                
                return {
                    success: true,
                    itemsAdded: newNfts.length,
                    hasMore: this.krc721HasMore(),
                    nextCursor: this.krc721PortfolioIndex
                };
            }
            
            return {
                success: true,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined
            };
        } catch (error) {
            console.error('Error loading more KRC721 NFTs:', error);
            return {
                success: false,
                itemsAdded: 0,
                hasMore: this.krc721HasMore(),
                nextCursor: this.krc721PortfolioIndex,
                error: (error as Error).message
            };
        }
    }

    /**
     * Load initial KNS domains (first page only)
     * Smart auto-reload: Fetches as many domains as user has already loaded
     */
    protected async getKnsInfo(walletAddress: string): Promise<KnsDomainAsset[]> {
        const existingData = this.data['kns']() as KnsDomainAsset[] | undefined;
        const isAutoReload = existingData !== undefined && existingData.length > 0;
        
        if (isAutoReload) {
            // Smart fetch: Get as many pages as user has loaded
            const pagesToFetch = this.knsLoadedPages();
            
            // Fetch all loaded pages
            const allFreshDomains: KnsDomainAsset[] = [];
            let lastPagination: any = null;
            
            for (let page = 1; page <= pagesToFetch; page++) {
                const response = await firstValueFrom(
                    this.knsApiService.fetchAssetsByOwner(
                        walletAddress,
                        page,
                        this.KNS_PAGE_SIZE
                    )
                );
                
                if (response.data) {
                    allFreshDomains.push(...(response.data.assets || []));
                    lastPagination = response.data.pagination;
                    
                    // If we got fewer items than expected, no more pages
                    if (page >= response.data.pagination.totalPages) {
                        break;
                    }
                } else {
                    break;
                }
            }
            
            // Smart merge with deduplication
            const { merged, newItems, removedCount } = this.mergeKnsData(existingData, allFreshDomains);
            
            // Update pagination state based on last response
            if (lastPagination) {
                this.knsCurrentPage.set(lastPagination.currentPage);
                this.knsTotalPages.set(lastPagination.totalPages);
            }
            
            // If new items found, set hasMore to true (more might exist beyond)
            if (newItems.length > 0) {
                this.knsHasMore.set(true);
            }
            
            return merged;
        } else {
            // Initial load: Load first page only
            this.knsCurrentPage.set(1);
            this.knsTotalPages.set(1);
            this.knsHasMore.set(true);
            this.knsLoadedPages.set(1);
            
            const response = await firstValueFrom(
                this.knsApiService.fetchAssetsByOwner(
                    walletAddress,
                    1,
                    this.KNS_PAGE_SIZE
                )
            );

            if (response.data) {
                const domains = response.data.assets || [];
                const pagination = response.data.pagination;
                
                // Update pagination state
                this.knsCurrentPage.set(pagination.currentPage);
                this.knsTotalPages.set(pagination.totalPages);
                this.knsHasMore.set(pagination.currentPage < pagination.totalPages);
                
                return domains;
            }
            
            return [];
        }
    }
    
    /**
     * Load more KNS domains (next page)
     * Called by KnsListService when scrolling
     */
    async loadMoreKnsDomains(): Promise<LoadMoreStoreResult> {
        const currentPage = this.knsCurrentPage();
        const totalPages = this.knsTotalPages();
        const hasMore = this.knsHasMore();
        
        if (!hasMore || currentPage >= totalPages) {
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined
            };
        }
        
        try {
            const walletAddress = await this.getWalletAddress();
            const nextPage = currentPage + 1;
            
            const response = await firstValueFrom(
                this.knsApiService.fetchAssetsByOwner(
            walletAddress,
                    nextPage,
                    this.KNS_PAGE_SIZE
                )
            );
            
            if (response.data) {
                const newDomains = response.data.assets || [];
                const pagination = response.data.pagination;
                
                // Append to existing data
                const currentDomains = this.data[L1_ASSET_KEYS.kns]() || [];
                this.data[L1_ASSET_KEYS.kns].set([...currentDomains, ...newDomains]);
                
                // Update pagination state
                this.knsCurrentPage.set(pagination.currentPage);
                this.knsTotalPages.set(pagination.totalPages);
                this.knsHasMore.set(pagination.currentPage < pagination.totalPages);
                this.knsLoadedPages.update(p => p + 1); // Track pages loaded
                
                return {
                    success: true,
                    itemsAdded: newDomains.length,
                    hasMore: this.knsHasMore(),
                    nextCursor: this.knsHasMore() ? pagination.currentPage : undefined
                };
            }
            
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined,
                error: 'No data in response'
            };
        } catch (error) {
            console.error('Error loading more KNS domains:', error);
            return {
                success: false,
                itemsAdded: 0,
                hasMore: hasMore,
                nextCursor: currentPage,
                error: (error as Error).message
            };
        }
    }

    /**
     * Helper to fetch next batch of KRC721 tokens from portfolio
     */
    private async fetchNextKrc721Batch(walletAddress: string, targetCount = this.KRC721_PAGE_SIZE): Promise<Krc721Nft[]> {
        const results: Krc721Nft[] = [];
        
        // 1. Drain queue first
        while (this.krc721TokenQueue.length > 0 && results.length < targetCount) {
            results.push(this.krc721TokenQueue.shift()!);
        }
        
        // 2. Fetch more if needed
        while (results.length < targetCount && this.krc721PortfolioIndex < this.krc721PortfolioSummary.length) {
            const item = this.krc721PortfolioSummary[this.krc721PortfolioIndex];
            this.krc721PortfolioIndex++;
            
            try {
                // Fetch collection info if needed for totalSupply
                let totalSupply = this.krc721CollectionCache.get(item.ticker);
                if (totalSupply === undefined) {
                    try {
                        const collectionDetails = await firstValueFrom(this.krc721ApiService.getCollectionDetails(item.ticker));
                        if (collectionDetails && collectionDetails.message === 'success') {
                           // Use max supply if totalSupply is missing, or minted if available
                           const supply = collectionDetails.result.totalSupply || collectionDetails.result.max || collectionDetails.result.minted;
                           totalSupply = parseInt(supply);
                           this.krc721CollectionCache.set(item.ticker, totalSupply);
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch collection details for ${item.ticker}`, e);
                    }
                }

                // fetch details
                let details;
                try {
                    details = await firstValueFrom(this.krc721ApiService.getPortfolioDetails(walletAddress, item.ticker));
                } catch (e) {
                    // ignore error
                }
                
                if (details && details.length > 0) {
                     // The details response is Array<Krc721PortfolioDetailItem>
                     // Each item has tokenIds: Krc721PortfolioTokenDetail[]
                     const nfts = details.flatMap((d: any) => d.tokenIds.map((t: any) => this.mapPortfolioTokenToNft(d.ticker, t, walletAddress, totalSupply)));
                     
                     for (const nft of nfts) {
                        if (results.length < targetCount) {
                            results.push(nft);
                        } else {
                            this.krc721TokenQueue.push(nft);
                        }
                    }
                } else if (item.tokenIds && item.tokenIds.length > 0) {
                    // Fallback to basic NFTs from summary if details missing
                    const nfts = item.tokenIds.map(tokenId => this.mapPortfolioTokenToNft(item.ticker, tokenId, walletAddress, totalSupply));
                    for (const nft of nfts) {
                        if (results.length < targetCount) {
                            results.push(nft);
                        } else {
                            this.krc721TokenQueue.push(nft);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching portfolio details for ${item.ticker}:`, error);
                // Continue to next ticker
            }
        }
        
        return results;
    }

    private mapPortfolioTokenToNft(ticker: string, token: any, owner: string, totalSupply?: number): Krc721Nft {
        // Handle both object (from detail) and string (from summary/fallback) token formats
        const tokenId = (typeof token === 'object' && token.tokenId !== undefined) ? token.tokenId.toString() : token.toString();
        const rarityRank = (typeof token === 'object') ? token.rarityRank : undefined;
        const legendary = (typeof token === 'object') ? token.legendary : undefined;
        const traits = (typeof token === 'object') ? token.traits : undefined;

        return {
            tick: ticker,
            tokenId: tokenId,
            owner: owner,
            rarityRank: rarityRank,
            legendary: legendary,
            totalSupply: totalSupply,
            metadata: {
                attributes: this.mapTraitsToAttributes(traits)
            },
            rawTraits: traits
        };
    }

    private mapTraitsToAttributes(traits: any): any[] {
        if (!traits) return [];
        return Object.entries(traits).map(([key, value]) => ({
            trait_type: key,
            value: value as string | number
        }));
    }
    
    /**
     * Override clearAllAssets to also reset pagination states
     */
    protected override clearAllAssets(): void {
        super.clearAllAssets();
        // Reset KRC721 pagination state
        this.krc721NextCursor.set(undefined);
        this.krc721HasMore.set(true);
        this.krc721LoadedPages.set(0);
        // Reset KNS pagination state
        this.knsCurrentPage.set(1);
        this.knsTotalPages.set(1);
        this.knsHasMore.set(true);
        this.knsLoadedPages.set(0);
        // Reset KRC20 pagination state
        this.krc20NextCursor.set(undefined);
        this.krc20HasMore.set(true);
        this.krc20LoadedPages.set(0);
    }

}