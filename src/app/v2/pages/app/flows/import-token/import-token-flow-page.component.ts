import { Component, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NotificationService } from 'kaspacom-ui';
import { KcInputComponent, KcButtonComponent, KcIconComponent } from '@kaspacom/ui-kit';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { ethers } from 'ethers';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';
import { L2AssetsStoreService } from '../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

type ImportState = 'idle' | 'loading' | 'found' | 'already-imported' | 'error';

@Component({
  selector: 'app-import-token-flow-page',
  standalone: true,
  imports: [
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcIconComponent,
    SkeletonComponent,
  ],
  templateUrl: './import-token-flow-page.component.html',
  styleUrl: './import-token-flow-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class ImportTokenFlowPageComponent {
  private assetsManagerService = inject(AssetsManagerService);
  private flowPagesService = inject(FlowPagesService);
  private notificationService = inject(NotificationService);

  contractAddress = signal<string>('');
  isAddressValid = computed(() =>
    ethers.isAddress(this.contractAddress().trim()),
  );
  showAddressError = computed(
    () => this.contractAddress().trim().length > 0 && !this.isAddressValid(),
  );
  state = signal<ImportState>('idle');
  errorMessage = signal<string>('');
  tokenInfo = signal<Erc20Token | null>(null);
  isSaving = signal<boolean>(false);

  /** Increments on each new lookup; lets in-flight promises detect stale results */
  private lookupId = 0;

  private get l2Store(): L2AssetsStoreService {
    return this.assetsManagerService.getAllAssetStores()
      .l2 as L2AssetsStoreService;
  }

  onAddressChange(value: string): void {
    this.contractAddress.set(value || '');
    // Reset state when address changes; increment lookupId to abort in-flight lookup
    if (this.state() !== 'idle') {
      this.lookupId++;
      this.state.set('idle');
      this.tokenInfo.set(null);
      this.errorMessage.set('');
    }
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.onAddressChange(text.trim());
    } catch {
      this.notificationService.error(
        'Clipboard Error',
        'Could not read from clipboard',
      );
    }
  }

  async lookupToken(): Promise<void> {
    const address = this.contractAddress().trim();
    if (!address) {
      this.tokenInfo.set(null);
      this.errorMessage.set('Please enter a contract address');
      this.state.set('error');
      return;
    }

    // Basic EVM address validation
    if (!ethers.isAddress(address)) {
      this.tokenInfo.set(null);
      this.errorMessage.set('Invalid contract address format');
      this.state.set('error');
      return;
    }

    const normalizedAddress = ethers.getAddress(address);

    // Capture the current lookup ID; if it changes while awaiting, we discard results
    this.lookupId++;
    const thisLookupId = this.lookupId;

    this.state.set('loading');
    this.tokenInfo.set(null);
    this.errorMessage.set('');

    try {
      // Check if already imported
      const savedToken =
        await this.l2Store.getSavedErc20TokenLocally(normalizedAddress);

      // Abort if the user changed the address while we were waiting
      if (this.lookupId !== thisLookupId) return;

      try {
        // Always try to fetch fresh token data (balance + current metadata)
        const freshToken =
          await this.l2Store.getErc20InfoFromBlockchain(normalizedAddress);
        if (this.lookupId !== thisLookupId) return;
        this.tokenInfo.set(
          savedToken ? { ...savedToken, ...freshToken } : freshToken,
        );
        if (savedToken) {
          this.errorMessage.set('Token has already been added.');
          this.state.set('already-imported');
        } else {
          this.state.set('found');
        }
      } catch {
        if (this.lookupId !== thisLookupId) return;
        if (savedToken) {
          // Show local metadata even if blockchain fetch failed
          this.tokenInfo.set(savedToken);
          this.errorMessage.set('Token has already been added.');
          this.state.set('already-imported');
        } else {
          throw new Error(
            'Token not found. Make sure the address is a valid ERC20 contract.',
          );
        }
      }
    } catch (err: any) {
      if (this.lookupId !== thisLookupId) return;
      console.error('Failed to load token:', err);
      this.errorMessage.set(
        err?.message ||
          'Token not found. Make sure the address is a valid ERC20 contract.',
      );
      this.state.set('error');
    }
  }

  async onAccept(): Promise<void> {
    const token = this.tokenInfo();
    if (!token) return;

    this.isSaving.set(true);
    try {
      await this.l2Store.addTokenToLocalStore(token);
      this.notificationService.success(
        'Token Imported',
        `${token.symbol} has been added to your wallet`,
      );
      this.flowPagesService.closePage();
    } catch (err: any) {
      this.notificationService.error(
        'Import Failed',
        err?.message || 'Failed to save token',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.flowPagesService.closePage();
  }

  shortAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  formatBalance(token: Erc20Token): string {
    if (token.balance === undefined || token.balance === null) return '0';
    return Number(token.balance).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  }
}
