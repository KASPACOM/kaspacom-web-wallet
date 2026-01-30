import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { TokenLogoComponent } from '../../../../../../components/token-logo/token-logo.component';
import { BaseSendAssetsContainerComponent } from './base-send-assets-container';

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
