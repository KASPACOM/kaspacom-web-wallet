import { CommonModule, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Erc20TokenLogoComponent } from '../../logo/erc20-token-logo/erc20-token-logo.component';
import type { Erc20TokenWithPrice } from '../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';

@Component({
  selector: 'erc20-asset-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe, UpperCasePipe, Erc20TokenLogoComponent],
  templateUrl: './erc20-asset-card.component.html',
  styleUrl: './erc20-asset-card.component.scss',
})
export class Erc20AssetCardComponent {
  token = input<Erc20TokenWithPrice | undefined>(undefined);

  readonly cardClick = output<void>();

  onClick(): void {
    // TODO: The 'emit' function requires a mandatory void argument
    this.cardClick.emit();
  }
}
