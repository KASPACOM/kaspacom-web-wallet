import { Component, EventEmitter, Output, input } from '@angular/core';
import {
  CommonModule,
  DecimalPipe,
  TitleCasePipe,
  UpperCasePipe,
} from '@angular/common';
import { TokenLogoComponent } from '../../pages/app/common/krc20/token-logo/token-logo.component';
import { SkeletonComponent } from '../ui/skeleton/skeleton.component';

export type AssetCardType = 'krc20' | 'erc20';

export interface Krc20AssetCardData {
  name: string;
  symbol: string;
  address: string;
  balance: number;
  usdPrice?: number;
  isLoadingMetadata?: boolean;
  holders?: number;
  maxSupply?: string | number;
}

export interface Erc20AssetCardData {
  name: string;
  symbol: string;
  address: string;
  balance: number;
  usdPrice?: number;
}

@Component({
  selector: 'app-asset-card',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    TokenLogoComponent,
    SkeletonComponent,
  ],
  templateUrl: './asset-card.component.html',
  styleUrl: './asset-card.component.scss',
})
export class AssetCardComponent {
  type = input<AssetCardType>('krc20');
  krc20 = input<Krc20AssetCardData | undefined>(undefined);
  erc20 = input<Erc20AssetCardData | undefined>(undefined);

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    this.cardClick.emit();
  }
}
