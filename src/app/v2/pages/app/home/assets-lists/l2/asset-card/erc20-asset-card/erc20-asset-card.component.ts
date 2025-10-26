import { Component, EventEmitter, Output, input } from '@angular/core';
import {
  CommonModule,
  DecimalPipe,
  TitleCasePipe,
  UpperCasePipe,
} from '@angular/common';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { Erc20TokenLogoComponent } from '../../logo/erc20-token-logo/erc20-token-logo.component';

@Component({
  selector: 'erc20-asset-card',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    Erc20TokenLogoComponent,
  ],
  templateUrl: './erc20-asset-card.component.html',
  styleUrl: './erc20-asset-card.component.scss',
})
export class Erc20AssetCardComponent {
  token = input<Erc20Token | undefined>(undefined);

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    this.cardClick.emit();
  }

  
}
