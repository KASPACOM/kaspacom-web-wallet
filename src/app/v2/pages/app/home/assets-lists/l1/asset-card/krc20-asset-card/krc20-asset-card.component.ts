import { Component, inject, input, output } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { ITokenWithMetadata } from '../../../../../common/interfaces/token.interface';
import { Krc20TokenLogoComponent } from '../../logo/krc20-token-logo/krc20-token-logo.component';
import { KaspaPriceService } from '../../../../../../../../services/kaspa-price.service';

@Component({
  selector: 'krc20-asset-card',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    Krc20TokenLogoComponent,
    SkeletonComponent,
  ],
  templateUrl: './krc20-asset-card.component.html',
  styleUrl: './krc20-asset-card.component.scss',
})
export class Krc20AssetCardComponent {
  krc20 = input<ITokenWithMetadata | undefined>(undefined);
  kaspaPriceService = inject(KaspaPriceService);

  readonly cardClick = output<void>();

  onClick(): void {
    // TODO: The 'emit' function requires a mandatory void argument
    this.cardClick.emit();
  }

  getPriceUsd(kasAmount: number): number {
    return this.kaspaPriceService.price() * kasAmount;
  }
}
