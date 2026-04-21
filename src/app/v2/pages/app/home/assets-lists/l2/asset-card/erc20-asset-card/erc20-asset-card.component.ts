import { CommonModule, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { TokenLogoComponent } from '../../../../../../../../components/token-logo/token-logo.component';
import type { Erc20TokenWithPrice } from '../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';

@Component({
  selector: 'erc20-asset-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe, UpperCasePipe, TokenLogoComponent],
  templateUrl: './erc20-asset-card.component.html',
  styleUrl: './erc20-asset-card.component.scss',
})
export class Erc20AssetCardComponent {
  token = input<Erc20TokenWithPrice | undefined>(undefined);

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    this.cardClick.emit();
  }
}
