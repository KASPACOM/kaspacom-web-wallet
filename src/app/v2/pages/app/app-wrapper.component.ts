import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { navAnimation } from './common/animation/nav.animation';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { FlowPageComponent } from './common/flow-page/flow-page.component';
import { AccountSettingsService } from '../../services/account-settings.service';
import { FlowPagesService } from '../../services/flow-pages.service';
import { QuickActionDialogService } from '../../services/quick-action-dialog.service';
import { ReviewActionComponent } from '../../../components/wallet-actions-reviews/review-action/review-action.component';
import { DynamicFlowPageOutletComponent } from './common/flow-page/dynamic-flow-page-outlet.component';
import { DynamicQuickActionDialogOutletComponent } from './common/quick-action-dialog/dynamic-quick-action-dialog-outlet.component';

import { KcSnackbarComponent } from '@kaspacom/ui';
import { OnInit } from '@angular/core';
import { WalletService } from '../../../services/wallet.service';
import { AssetsStoreService } from '../../../services/assets-store.service';

@Component({
  selector: 'app-app-wrapper',
  imports: [
    CommonModule,
    RouterOutlet,
    WrapperHeaderComponent,
    WrapperNavComponent,
    FlowPageComponent,
    DynamicFlowPageOutletComponent,
    DynamicQuickActionDialogOutletComponent,
    ReviewActionComponent,

    KcSnackbarComponent,
  ],
  templateUrl: './app-wrapper.component.html',
  styleUrl: './app-wrapper.component.scss',
  animations: [navAnimation],
})
export class AppWrapperComponent implements OnInit {
  private contexts = inject(ChildrenOutletContexts);
  accountSettingsService = inject(AccountSettingsService);
  flowPagesService = inject(FlowPagesService);
  quickActionDialogService = inject(QuickActionDialogService);
  private walletService = inject(WalletService);
  private assetsStore = inject(AssetsStoreService);

  // Detect if any data is loading on the homepage
  isMainContentLoading = computed(() => {
    const currentWallet = this.walletService.getCurrentWallet();
    
    // If no wallet is selected, consider it loading
    if (!currentWallet) {
      return true;
    }

    // Check if any asset type is loading (kaspa, krc20, krc721, kns)
    const isAssetsLoading = this.assetsStore.isAnyAssetLoading();
    
    // Check if wallet balance data is loading (for UTXOs)
    const walletBalance = currentWallet.getBalanceSignal()();
    const isUtxosLoading = !walletBalance;
    
    return isAssetsLoading || isUtxosLoading;
  });

  async ngOnInit(): Promise<void> {
    // Ensure wallets are loaded into memory on app shell load
    await this.walletService.loadWallets();
    // Restore current selection (or pick first available)
    await this.walletService.selectCurrentWalletFromLocalStorageNullsafe();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }

  onFlowPageBackdropClick() {
    // Handle backdrop click - for wallet management, we should close it
    // For other pages, navigate back or close based on navigation capability
    const activePage = this.flowPagesService.activePage();
    if (activePage?.id === 'wallet-management') {
      this.accountSettingsService.close();
    } else if (this.flowPagesService.canNavigateBack()) {
      this.flowPagesService.navigateBack();
    } else {
      this.flowPagesService.closePage();
    }
  }

  onFlowPageClose() {
    // Handle close icon click - close the current page
    const activePage = this.flowPagesService.activePage();
    if (activePage?.id === 'wallet-management') {
      this.accountSettingsService.close();
    } else {
      this.flowPagesService.closePage();
    }
  }

  onQuickActionDialogBackdropClick() {
    // Handle backdrop click - close the quick action dialog
    this.quickActionDialogService.closeDialog();
  }

  onQuickActionDialogClose() {
    // Handle close icon click - close the quick action dialog
    this.quickActionDialogService.closeDialog();
  }
}
