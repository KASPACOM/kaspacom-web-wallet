import { Component, output } from '@angular/core';
import { BaseSendAssetsContainerComponent } from './base-send-assets-container';
import { CommonModule } from '@angular/common';
import { Erc20TokenLogoComponent } from '../../../home/assets-lists/l2/logo/erc20-token-logo/erc20-token-logo.component';

@Component({
  selector: 'app-l2-send-assets-container',
  standalone: true,
  imports: [CommonModule, Erc20TokenLogoComponent],
  templateUrl: './l2-send-assets-container.component.html',
  styleUrl: './l2-send-assets-container.component.scss',
})
export class L2SendAssetsContainerComponent extends BaseSendAssetsContainerComponent {
  kaspaClick = output<void>();
  erc20Click = output<void>();
}
