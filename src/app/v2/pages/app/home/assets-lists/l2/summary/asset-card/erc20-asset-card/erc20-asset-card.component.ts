import { Component, EventEmitter, Output, input } from '@angular/core';
import {
  CommonModule,
  DecimalPipe,
  TitleCasePipe,
  UpperCasePipe,
} from '@angular/common';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { SkeletonComponent } from '../../../../../../../../shared/ui/skeleton';

@Component({
  selector: 'erc20-asset-card',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    SkeletonComponent,
  ],
  templateUrl: './erc20-asset-card.component.html',
  styleUrl: './erc20-asset-card.component.scss',
})
export class Erc20AssetCardComponent {
  imageUrl = './images/kc-all-black.png';
  token = input<Erc20Token | undefined>(undefined);

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    this.cardClick.emit();
  }

  
}
