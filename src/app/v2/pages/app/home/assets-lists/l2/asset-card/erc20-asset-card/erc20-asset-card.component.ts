import {
  CommonModule,
  DecimalPipe,
  TitleCasePipe,
  UpperCasePipe,
} from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { TokenLogoComponent } from '../../../../../../../../components/token-logo/token-logo.component';

@Component({
  selector: 'erc20-asset-card',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    TokenLogoComponent,
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
