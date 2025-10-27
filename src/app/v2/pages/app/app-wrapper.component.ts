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
import { AssetsManagerService } from '../../../services/assets-manager/assets-manager.service';

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
export class AppWrapperComponent {
  private contexts = inject(ChildrenOutletContexts);
  accountSettingsService = inject(AccountSettingsService);
  flowPagesService = inject(FlowPagesService);
  quickActionDialogService = inject(QuickActionDialogService);
  private walletService = inject(WalletService);
  protected assetsManager = inject(AssetsManagerService);

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
