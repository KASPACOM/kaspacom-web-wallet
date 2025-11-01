import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import { BaseAssetsStoreService, BaseAssetStoreData } from "./base-assets-store.service";
import { GetTokenListDto, GetTokenListResponse } from "../../kasplex-api/dtos/token-list-info.dto";
import { Krc721Nft } from "../../krc721-api/dtos/krc721-nft.dto";
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
     * Smart auto-reload: Fetches as many NFTs as user has already loaded
     */
    protected async getKrc721Info(walletAddress: string): Promise<Krc721Nft[]> {
        const existingData = this.data['krc721']() as Krc721Nft[] | undefined;
        const isAutoReload = existingData !== undefined && existingData.length > 0;
        
        if (isAutoReload) {
            // Smart fetch: Get as many NFTs as user has loaded (paginated)
            const itemsToFetch = existingData.length;
            const pagesToFetch = this.krc721LoadedPages();
            
            // Fetch paginated to match what user has loaded
            const allFreshNfts: Krc721Nft[] = [];
            let currentCursor: number | undefined = undefined;
            
            for (let i = 0; i < pagesToFetch; i++) {
                const response: { message: string; result?: Krc721Nft[]; next?: number } = await firstValueFrom(
            this.krc721ApiService.getAddressNfts(
                walletAddress,
                        currentCursor,
                        this.KRC721_PAGE_SIZE,
                        'forward'
            ),
        );

        if (response.message === 'success' && response.result) {
                    allFreshNfts.push(...response.result);
                    currentCursor = response.next;
                    
                    // If we got fewer items than page size, no more to fetch
                    if (!response.next || response.result.length < this.KRC721_PAGE_SIZE) {
                        break;
                    }
                } else {
                    break;
                }
            }
            
            // Smart merge with deduplication
            const { merged, newItems, removedCount } = this.mergeKrc721Data(existingData, allFreshNfts);
            
            // Update cursor to last item BEFORE new items (maintains pagination continuity)
            const lastOriginalIndex = merged.length - newItems.length - 1;
            if (lastOriginalIndex >= 0 && merged[lastOriginalIndex]) {
                const lastNft = merged[lastOriginalIndex];
                this.krc721NextCursor.set(`${lastNft.tick}-${lastNft.tokenId}` as any);
            }
            
            // If new items found, set hasMore to true (more might exist beyond)
            if (newItems.length > 0) {
                this.krc721HasMore.set(true);
            }
            
            return merged;
        } else {
            // Initial load: Reset pagination state
            this.krc721NextCursor.set(undefined);
            this.krc721HasMore.set(true);
            this.krc721LoadedPages.set(1); // Track initial page
            
            // Load first page only
            const response = await firstValueFrom(
                this.krc721ApiService.getAddressNfts(
                    walletAddress,
                    undefined, // No offset for first page
                    this.KRC721_PAGE_SIZE,
                    'forward'
                ),
            );

            if (response.message === 'success') {
                const nfts = response.result || [];
                
                // Update pagination state
                    this.krc721NextCursor.set(response.next);
                    this.krc721HasMore.set(response.next !== undefined && nfts.length === this.KRC721_PAGE_SIZE);
                    
                    return nfts;
        } else {
            throw new Error('KRC721 API response not successful');
            }
        }
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
        const cursor = this.krc721NextCursor();
        const hasMore = this.krc721HasMore();
        
        if (!hasMore || cursor === undefined) {
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined
            };
        }
        
        try {
            const walletAddress = await this.getWalletAddress();
            
            const response = await firstValueFrom(
                this.krc721ApiService.getAddressNfts(
                    walletAddress,
                    cursor,
                    this.KRC721_PAGE_SIZE,
                    'forward'
                ),
            );
            
            if (response.message === 'success') {
                const newNfts = response.result || [];
                
                // Append to existing data
                const currentNfts = this.data[L1_ASSET_KEYS.krc721]() || [];
                this.data[L1_ASSET_KEYS.krc721].set([...currentNfts, ...newNfts]);
                
                // Update pagination state
                this.krc721NextCursor.set(response.next);
                this.krc721HasMore.set(response.next !== undefined && newNfts.length === this.KRC721_PAGE_SIZE);
                this.krc721LoadedPages.update(p => p + 1); // Track pages loaded
                
                return {
                    success: true,
                    itemsAdded: newNfts.length,
                    hasMore: this.krc721HasMore(),
                    nextCursor: response.next
                };
            }
            
            return {
                success: false,
                itemsAdded: 0,
                hasMore: false,
                nextCursor: undefined,
                error: 'API response not successful'
            };
        } catch (error) {
            console.error('Error loading more KRC721 NFTs:', error);
            return {
                success: false,
                itemsAdded: 0,
                hasMore: hasMore,
                nextCursor: cursor,
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