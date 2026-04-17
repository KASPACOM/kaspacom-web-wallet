import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  inject,
  input,
  signal,
  computed,
  effect,
  untracked,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcBaseModalComponent, KcInputComponent } from 'kaspacom-ui';
import { MessagePopupService } from '../../../../../../../services/message-popup.service';
import type { Erc20Token } from '@kaspacom/swap-sdk';
import { CommaFormatterPipe } from '../../../../../../../pipes/comma-formatter.pipe';
import { TokenLogoComponent } from '../../../../../../../components/token-logo/token-logo.component';
import {
  KaspaComDefiApiService,
  DexTokenSearchResult,
  LfgSearchToken,
} from '../../../../../../../services/kaspacom-api/kaspacom-defi-api.service';
import { EthereumWalletChainManager } from '../../../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { environment } from '../../../../../../../../environments/environment';

const HISTORY_STORAGE_KEY_PREFIX = 'swap-token-search-history';
const DEFAULT_DECIMALS = 18;

function safeDecimals(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DECIMALS;
}
const MAX_HISTORY = 3;
const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function isLocalStorageAvailable(): boolean {
  try {
    const key = '__ls_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-token-selector-modal',
  standalone: true,
  imports: [
    CommonModule,
    KcBaseModalComponent,
    KcInputComponent,
    CommaFormatterPipe,
    TokenLogoComponent,
  ],
  templateUrl: './token-selector-modal.component.html',
  styleUrl: './token-selector-modal.component.scss',
})
export class TokenSelectorModalComponent implements OnInit {
  private messagePopupService = inject(MessagePopupService);
  private defiApiService = inject(KaspaComDefiApiService);
  private chainManager = inject(EthereumWalletChainManager);
  private destroyRef = inject(DestroyRef);

  hasChain = computed(() => !!this.chainManager.getCurrentChainSignal()());

  private historyStorageKey = computed(() => {
    const chainId = this.chainManager.getCurrentChainSignal()();
    const chainConfig = chainId ? this.chainManager.getChainConfig(chainId) : undefined;
    const network = chainConfig?.defiApiNetworkName || chainConfig?.chainName || 'unknown';
    const env = environment.isProduction ? 'prod' : 'dev';
    return `${HISTORY_STORAGE_KEY_PREFIX}-${network}-${env}`;
  });

  open = input(false);
  isLoading = input(false);
  tokens = input<Erc20Token[]>([]);
  excludedToken = input<Erc20Token | null>(null);
  @Output() close = new EventEmitter<void>();
  @Output() selectToken = new EventEmitter<Erc20Token>();

  // Search state
  searchQuery = signal('');
  searchLoading = signal(false);
  searchResults = signal<Erc20Token[]>([]);

  // Default state (no query)
  mostTradedTokens = signal<Erc20Token[]>([]);
  mostTradedLoading = signal(false);
  searchHistory = signal<Erc20Token[]>([]);

  private localStorageAvailable = isLocalStorageAvailable();
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private searchRequestId = 0;
  // Track which chain the cached mostTradedTokens were fetched for.
  private mostTradedChainId: string | undefined = undefined;

  constructor() {
    // Reload when the modal opens so timing issues on initial mount don't leave
    // the section empty (the component is always in the DOM, ngOnInit fires once).
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (!isOpen) {
          if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
          }
          this.searchRequestId++;
          this.searchResults.set([]);
          this.searchLoading.set(false);
          return;
        }
        this.searchQuery.set('');
        this.searchResults.set([]);
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = null;
        }
        this.loadSearchHistory();
        const currentChainId = this.chainManager.getCurrentChainSignal()();
        if (currentChainId) {
          const chainChanged = currentChainId !== this.mostTradedChainId;
          if ((!this.mostTradedTokens().length || chainChanged) && !this.mostTradedLoading()) {
            this.loadMostTradedTokens();
          }
        }
      });
    });
  }

  // User's own tokens (sorted by balance, minus excluded)
  userTokens = computed(() => {
    const excluded = this.excludedToken();
    const tokens = this.tokens();
    const filtered = excluded
      ? tokens.filter(
          (t) => t.address.toLowerCase() !== excluded.address.toLowerCase(),
        )
      : tokens;
    return this.sortByBalance(filtered);
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);

    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);

    if (!value.trim()) {
      this.searchResults.set([]);
      this.searchLoading.set(false);
      this.searchRequestId++;
      return;
    }

    this.searchResults.set([]);
    this.searchLoading.set(true);
    const requestId = ++this.searchRequestId;
    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch(value.trim(), requestId);
    }, 300);
  }

  onRowKey(event: KeyboardEvent, token: Erc20Token): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') { this.onTokenSelect(token); return; }
    if (event.key === ' ') { event.preventDefault(); this.onTokenSelect(token); }
  }

  async onTokenSelect(token: Erc20Token): Promise<void> {
    this.addToHistory(token);
    this.selectToken.emit(token);
  }

  onClose(): void {
    this.close.emit();
  }

  async copyAddress(event: Event, address: string): Promise<void> {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      this.messagePopupService.showSuccess('Address copied to clipboard');
    } catch {
      this.messagePopupService.showError('Failed to copy address');
    }
  }

  shortenAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private sortByBalance(list: Erc20Token[]): Erc20Token[] {
    return [...list].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  }

  private async performSearch(query: string, requestId: number): Promise<void> {
    try {
      let results: Erc20Token[];

      if (EVM_ADDRESS_REGEX.test(query)) {
        results = await this.searchByAddress(query);
      } else {
        results = await this.searchByTerm(query);
      }

      if (!this.destroyed && requestId === this.searchRequestId) {
        this.searchResults.set(results);
      }
    } catch {
      if (!this.destroyed && requestId === this.searchRequestId) {
        this.searchResults.set([]);
      }
    } finally {
      if (!this.destroyed && requestId === this.searchRequestId) {
        this.searchLoading.set(false);
      }
    }
  }

  private async searchByAddress(address: string): Promise<Erc20Token[]> {
    const lowerAddr = address.toLowerCase();
    const excluded = this.excludedToken();

    if (excluded && excluded.address.toLowerCase() === lowerAddr) {
      return [];
    }

    // Check local user tokens first
    const local = this.tokens().find(
      (t) => t.address.toLowerCase() === lowerAddr,
    );
    if (local) return [local];

    // Fall back to backend metadata endpoint — requires a chain to be selected
    if (!this.chainManager.getCurrentChainSignal()()) return [];
    const metadata = await this.defiApiService.getTokenMetadata(address);
    if (metadata?.name && metadata?.symbol) {
      return [
        {
          address,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: safeDecimals(metadata.decimals),
          balance: 0,
        },
      ];
    }

    return [];
  }

  private async searchByTerm(query: string): Promise<Erc20Token[]> {
    const [dexResults, lfgResults] = this.chainManager.getCurrentChainSignal()()
      ? await Promise.all([
          this.defiApiService.searchDexTokens(query),
          this.defiApiService.searchLfgTokens(query),
        ])
      : [[], []];

    const localBalanceMap = new Map<string, number>(
      this.tokens().map((t) => [t.address.toLowerCase(), t.balance ?? 0]),
    );
    const excluded = this.excludedToken();

    const seen = new Set<string>();
    const merged: Erc20Token[] = [];

    const addToken = (token: Erc20Token) => {
      const addrLower = token.address.toLowerCase();
      if (seen.has(addrLower)) return;
      if (excluded && excluded.address.toLowerCase() === addrLower) return;
      seen.add(addrLower);
      merged.push({
        ...token,
        balance: localBalanceMap.get(addrLower) ?? token.balance ?? 0,
      });
    };

    // User tokens matching the query first
    const queryLower = query.toLowerCase();
    for (const t of this.tokens()) {
      if (
        t.name?.toLowerCase().includes(queryLower) ||
        t.symbol?.toLowerCase().includes(queryLower) ||
        t.address?.toLowerCase().includes(queryLower)
      ) {
        addToken(t);
      }
    }

    for (const r of dexResults) {
      addToken(this.dexResultToToken(r));
    }

    for (const r of lfgResults) {
      addToken(this.lfgResultToToken(r));
    }

    return this.sortByBalance(merged);
  }

  private dexResultToToken(r: DexTokenSearchResult): Erc20Token {
    return {
      address: r.id,
      name: r.name,
      symbol: r.symbol,
      decimals: safeDecimals(r.decimals),
      balance: 0,
    };
  }

  private lfgResultToToken(r: LfgSearchToken): Erc20Token {
    return {
      address: r.tokenAddress,
      name: r.name,
      symbol: r.ticker,
      decimals: r.decimals,
      balance: 0,
    };
  }

  private async loadMostTradedTokens(): Promise<void> {
    const chainIdAtFetch = this.chainManager.getCurrentChainSignal()();
    if (!chainIdAtFetch) return;
    this.mostTradedLoading.set(true);
    try {
      const pairs = await this.defiApiService.getMostTradedPairs();

      const localBalanceMap = new Map<string, number>(
        this.tokens().map((t) => [t.address.toLowerCase(), t.balance ?? 0]),
      );
      // Tokens the user already owns — hide them from "Most traded" to avoid duplication
      const userTokenAddresses = new Set<string>(
        this.tokens().map((t) => t.address.toLowerCase()),
      );
      const excluded = this.excludedToken();

      const uniqueTokens = new Map<string, Erc20Token>();
      for (const info of pairs.slice(0, 15)) {
        for (const raw of [info.pair.token0, info.pair.token1]) {
          const addr = raw.id;
          if (!addr) continue;
          const addrLower = addr.toLowerCase();
          if (uniqueTokens.has(addrLower)) continue;
          if (userTokenAddresses.has(addrLower)) continue;
          if (excluded && excluded.address.toLowerCase() === addrLower) continue;
          uniqueTokens.set(addrLower, {
            address: addr,
            name: raw.name ?? '',
            symbol: raw.symbol ?? '',
            decimals: safeDecimals(raw.decimals),
            balance: localBalanceMap.get(addrLower) ?? 0,
          });
        }
      }

      const currentChainId = this.chainManager.getCurrentChainSignal()();
      if (!this.destroyed && currentChainId === chainIdAtFetch) {
        this.mostTradedTokens.set(Array.from(uniqueTokens.values()));
        this.mostTradedChainId = chainIdAtFetch;
      }
    } catch (err) {
      console.warn('[TokenSelector] Failed to load most traded tokens:', err);
    } finally {
      if (!this.destroyed && this.chainManager.getCurrentChainSignal()() === chainIdAtFetch) {
        this.mostTradedLoading.set(false);
      }
    }
  }

  private isStoredHistoryToken(value: unknown): value is Erc20Token {
    if (!value || typeof value !== 'object') return false;

    const token = value as Partial<Erc20Token>;
    return (
      typeof token.address === 'string' &&
      typeof token.name === 'string' &&
      typeof token.symbol === 'string' &&
      typeof token.decimals === 'number'
    );
  }

  private loadSearchHistory(): void {
    if (!this.localStorageAvailable) return;
    try {
      const raw = localStorage.getItem(this.historyStorageKey());
      if (!raw) {
        this.searchHistory.set([]);
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.searchHistory.set([]);
        return;
      }

      this.searchHistory.set(
        parsed.filter((item): item is Erc20Token => this.isStoredHistoryToken(item)).slice(0, MAX_HISTORY),
      );
    } catch {
      this.searchHistory.set([]);
    }
  }

  private addToHistory(token: Erc20Token): void {
    if (!this.localStorageAvailable) return;
    try {
      let history = this.searchHistory();
      history = history.filter(
        (t) => t.address.toLowerCase() !== token.address.toLowerCase(),
      );
      history.unshift({ ...token, balance: token.balance ?? 0 });
      if (history.length > MAX_HISTORY) history.pop();
      this.searchHistory.set(history);
      localStorage.setItem(this.historyStorageKey(), JSON.stringify(history));
    } catch {
      // ignore
    }
  }
}
