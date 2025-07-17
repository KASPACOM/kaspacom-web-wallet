import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { navAnimation } from './common/animation/nav.animation';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { FlowPageComponent } from './common/flow-page/flow-page.component';
import { WalletManagementPageComponent } from './common/wallet-management-page/wallet-management-page.component';
import { SendPageComponent } from './common/send-page/send-page.component';
import { SendKaspaComponent } from './common/send-page/components/send-kaspa.component';
import { SendKrc20ListComponent } from './common/send-page/components/send-krc20-list.component';
import { SendKrc20Component } from './common/send-page/components/send-krc20.component';
import { SendNftListComponent } from './common/send-page/components/send-nft-list.component';
import { SendNftComponent } from './common/send-page/components/send-nft.component';
import { SendKnsListComponent } from './common/send-page/components/send-kns-list.component';
import { SendKnsComponent } from './common/send-page/components/send-kns.component';
import { AccountSettingsService } from './common/services/account-settings.service';
import { FlowPagesService } from './common/services/flow-pages.service';
import { ReviewActionComponent } from '../../../components/wallet-actions-reviews/review-action/review-action.component';

@Component({
  selector: 'app-app-wrapper',
  imports: [
    CommonModule,
    RouterOutlet,
    WrapperHeaderComponent,
    WrapperNavComponent,
    FlowPageComponent,
    WalletManagementPageComponent,
    SendPageComponent,
    SendKaspaComponent,
    SendKrc20ListComponent,
    SendKrc20Component,
    SendNftListComponent,
    SendNftComponent,
    SendKnsListComponent,
    SendKnsComponent,
    ReviewActionComponent
  ],
  templateUrl: './app-wrapper.component.html',
  styleUrl: './app-wrapper.component.scss',
  animations: [navAnimation],
})
export class AppWrapperComponent {
  private contexts = inject(ChildrenOutletContexts);
  accountSettingsService = inject(AccountSettingsService);
  flowPagesService = inject(FlowPagesService);

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
}
