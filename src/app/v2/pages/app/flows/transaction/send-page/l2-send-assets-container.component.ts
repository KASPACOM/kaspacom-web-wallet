import { Component, output } from '@angular/core';
import { BaseSendAssetsContainerComponent } from './base-send-assets-container';
import { CommonModule } from '@angular/common';
import { TokenLogoComponent } from '../../../common/krc20/token-logo/token-logo.component';

@Component({
  selector: 'app-l2-send-assets-container',
  standalone: true,
  imports: [CommonModule, TokenLogoComponent],
  templateUrl: './l2-send-assets-container.component.html',
  styleUrl: './l2-send-assets-container.component.scss',
})
export class L2SendAssetsContainerComponent extends BaseSendAssetsContainerComponent {
  kaspaClick = output<void>();
  erc20Click = output<void>();
}
