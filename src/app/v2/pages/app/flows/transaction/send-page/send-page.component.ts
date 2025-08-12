import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../common/flow-page/interfaces/flow-page.interface';
import { TokenLogoComponent } from '../../../common/krc20/token-logo/token-logo.component';

@Component({
  selector: 'app-send-page',
  standalone: true,
  imports: [CommonModule, TokenLogoComponent],
  templateUrl: './send-page.component.html',
  styleUrl: './send-page.component.scss'
})
export class SendPageComponent extends FlowPageBaseComponent {
  
  get config(): IFlowPageConfig {
    return {
      id: 'send',
      title: 'Send',
      canNavigateBack: true
    };
  }
  
  onKaspaCardClick(): void {
    this.navigateToNextPage({
      id: 'send-kaspa',
      title: 'Send Kaspa',
      canNavigateBack: true
    });
  }
  
  onKrc20CardClick(): void {
    this.navigateToNextPage({
      id: 'send-krc20-list',
      title: 'Select KRC20 Token',
      canNavigateBack: true
    });
  }
  
  onNftCardClick(): void {
    this.navigateToNextPage({
      id: 'send-nft-list',
      title: 'Select NFT',
      canNavigateBack: true
    });
  }
  
  onKnsCardClick(): void {
    this.navigateToNextPage({
      id: 'send-kns-list',
      title: 'Select KNS Domain',
      canNavigateBack: true
    });
  }
}