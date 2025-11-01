/**
 * Pagination state interface for managing lazy loading state
 * Follows DEVELOPMENT_RULES.md - predefined interfaces, no inline types
 */

export interface PaginationState {
  /** Current pagination cursor (string for KRC20, number for KRC721/KNS) */
  cursor: string | number | undefined;
  
  /** Whether more items are available to load */
  hasMore: boolean;
  
  /** Whether currently loading data */
  isLoading: boolean;
  
  /** Number of items per page */
  pageSize: number;
  
  /** Total number of items loaded so far */
  totalLoaded: number;
  
  /** Whether initial load has completed */
  initialLoadComplete: boolean;
}

/**
 * Status enum for pagination operations
 * Follows DEVELOPMENT_RULES.md - enums over union types
 */
export enum PaginationStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Result interface for load more operations
 * Follows DEVELOPMENT_RULES.md - predefined interfaces for return types
 */
export interface LoadMoreResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Number of items added in this load */
  itemsAdded: number;
  
  /** Total items after this load */
  totalItems: number;
  
  /** Whether more items are available */
  hasMore: boolean;
  
  /** Current status of the operation */
  status: PaginationStatus;
  
  /** Error message if operation failed */
  error?: string;
}

/**
 * Configuration interface for pagination behavior
 * Follows DEVELOPMENT_RULES.md - predefined interfaces
 */
export interface PaginationConfig {
  /** Number of items to load per page */
  pageSize: number;
  
  /** Scroll percentage threshold to trigger load (0-100) */
  scrollThreshold: number;
  
  /** Debounce time in milliseconds for scroll events */
  debounceMs: number;
  
  /** Enable greedy loading (auto-load if container not scrollable) */
  greedyLoading: boolean;
}

/**
 * Default pagination configurations for L1 assets
 * Based on kaspiano-front-v2 portfolio patterns
 */
export const L1_PAGINATION_CONFIG = {
  krc20: {
    pageSize: 50,
    scrollThreshold: 80,
    debounceMs: 120,
    greedyLoading: true
  } as PaginationConfig,
  
  krc721: {
    pageSize: 20,
    scrollThreshold: 80,
    debounceMs: 120,
    greedyLoading: true
  } as PaginationConfig,
  
  kns: {
    pageSize: 20,
    scrollThreshold: 80,
    debounceMs: 120,
    greedyLoading: true
  } as PaginationConfig
};

