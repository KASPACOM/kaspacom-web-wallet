import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { navAnimation } from './common/animation/nav.animation';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { FlowPageComponent } from './common/flow-page/flow-page.component';
import { QuickActionDialogComponent } from './common/quick-action-dialog/quick-action-dialog.component';
import { CreateWalletAccountQuickActionDialogComponent } from './common/quick-action-dialog/wrappers/create-wallet-account-quick-action-dialog.component';
import { EditWalletQuickActionDialogComponent } from './common/quick-action-dialog/wrappers/edit-wallet-quick-action-dialog.component';
import { DeleteWalletAccountQuickActionDialogComponent } from './common/quick-action-dialog/wrappers/delete-wallet-account-quick-action-dialog.component';
import { WalletOptionsQuickActionDialogComponent } from './common/quick-action-dialog/wrappers/wallet-options-quick-action-dialog.component';
import { WalletManagementPageComponent } from './flows/wallet-management/wallet-management-page/wallet-management-page.component';
import { SendPageComponent } from './flows/transaction/send-page/send-page.component';
import { SendKaspaComponent } from './flows/transaction/send-page/components/send-kaspa/send-kaspa.component';
import { SendKrc20ListComponent } from './flows/transaction/send-page/components/send-krc20-list/send-krc20-list.component';
import { SendKrc20Component } from './flows/transaction/send-page/components/send-krc20/send-krc20.component';
import { SendNftListComponent } from './flows/transaction/send-page/components/send-nft-list/send-nft-list.component';
import { SendNftComponent } from './flows/transaction/send-page/components/send-nft/send-nft.component';
import { SendKnsListComponent } from './flows/transaction/send-page/components/send-kns-list/send-kns-list.component';
import { SendKnsComponent } from './flows/transaction/send-page/components/send-kns/send-kns.component';
import { AccountSettingsService } from './common/services/account-settings.service';
import { FlowPagesService } from './common/services/flow-pages.service';
import { QuickActionDialogService } from './common/services/quick-action-dialog.service';
import { ReviewActionComponent } from '../../../components/wallet-actions-reviews/review-action/review-action.component';
import { ApprovalFlowPageComponent } from './flows/approval/approval-flow-page/approval-flow-page.component';
import { ReceiveFlowPageComponent } from './flows/receive/receive-flow-page.component';

import { KcSnackbarComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-app-wrapper',
  imports: [
    CommonModule,
    RouterOutlet,
    WrapperHeaderComponent,
    WrapperNavComponent,
    FlowPageComponent,
    QuickActionDialogComponent,
    CreateWalletAccountQuickActionDialogComponent,
    EditWalletQuickActionDialogComponent,
    DeleteWalletAccountQuickActionDialogComponent,
    WalletOptionsQuickActionDialogComponent,
    WalletManagementPageComponent,
    SendPageComponent,
    SendKaspaComponent,
    SendKrc20ListComponent,
    SendKrc20Component,
    SendNftListComponent,
    SendNftComponent,
    SendKnsListComponent,
    SendKnsComponent,
    ReviewActionComponent,
    ApprovalFlowPageComponent,
    ReceiveFlowPageComponent,

    KcSnackbarComponent
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
