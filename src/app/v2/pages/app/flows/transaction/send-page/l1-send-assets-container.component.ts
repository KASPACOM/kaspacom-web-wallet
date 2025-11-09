import { Component, output } from '@angular/core';
import { BaseSendAssetsContainerComponent } from './base-send-assets-container';
import { CommonModule } from '@angular/common';
import { Krc20TokenLogoComponent } from '../../../home/assets-lists/l1/logo/krc20-token-logo/krc20-token-logo.component';

@Component({
  selector: 'app-l1-send-assets-container',
  standalone: true,
  imports: [CommonModule, Krc20TokenLogoComponent],
  templateUrl: './l1-send-assets-container.component.html',
  styleUrl: './l1-send-assets-container.component.scss',
})
export class L1SendAssetsContainerComponent extends BaseSendAssetsContainerComponent {
  kaspaClick = output<void>();
  krc20Click = output<void>();
  nftClick = output<void>();
  knsClick = output<void>();
}
