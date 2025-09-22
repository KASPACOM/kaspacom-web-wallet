import { Component, EventEmitter, Output, input } from '@angular/core';
import {
  CommonModule,
  DecimalPipe,
  TitleCasePipe,
  UpperCasePipe,
} from '@angular/common';
import { TokenLogoComponent } from '../../pages/app/common/krc20/token-logo/token-logo.component';
import { SkeletonComponent } from '../ui/skeleton/skeleton.component';
import { ITokenWithMetadata } from '../../pages/app/common/interfaces/token.interface';

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
  krc20 = input<ITokenWithMetadata | undefined>(undefined);

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    this.cardClick.emit();
  }
}
