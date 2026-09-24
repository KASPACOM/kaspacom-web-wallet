import { computed, inject, linkedSignal } from '@angular/core';
import { WalletService } from '../../../../../services/wallet.service';

// Type-safe tab IDs
export const ASSET_TAB_IDS = {
  UTXOS: 'utxos',
  KRC20: 'krc20',
  KCC20: 'kcc20',
  KRC721: 'krc721',
  KNS: 'kns',
  L2_ERC20: 'l2-ERC20',
  L2_TX_HISTORY: 'l2-tx-history',
} as const;

export type AssetTabId = (typeof ASSET_TAB_IDS)[keyof typeof ASSET_TAB_IDS];

export class BaseAssetsContainerComponent {
  private walletService = inject(WalletService);

  // Network-reactive default tab selection
  private defaultTabId = computed(() =>
    this.walletService.isL2Display()
      ? ASSET_TAB_IDS.L2_ERC20
      : ASSET_TAB_IDS.UTXOS,
  );

  // Selected tab - linked to network changes for automatic default switching
  selectedTabId = linkedSignal<AssetTabId>(() => this.defaultTabId());

  onTabChange(tabId: string): void {
    this.selectedTabId.set(tabId as AssetTabId);
  }
}
