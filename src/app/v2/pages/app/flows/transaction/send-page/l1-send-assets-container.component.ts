import { Component, output } from '@angular/core';
import { BaseSendAssetsContainerComponent } from './base-send-assets-container';
import { CommonModule } from '@angular/common';
import { TokenLogoComponent } from '../../../common/krc20/token-logo/token-logo.component';

@Component({
  selector: 'app-l1-send-assets-container',
  standalone: true,
  imports: [CommonModule, TokenLogoComponent],
  templateUrl: './l1-send-assets-container.component.html',
  styleUrl: './l1-send-assets-container.component.scss',
})
export class L1SendAssetsContainerComponent extends BaseSendAssetsContainerComponent {
  kaspaClick = output<void>();
  krc20Click = output<void>();
  nftClick = output<void>();
  knsClick = output<void>();
}
