import { Component, input } from '@angular/core';
import { CommonModule, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Kcc20Holding } from '../../../../../../../../services/covenant/kcc20-holdings.service';
import { Kcc20TokenLogoComponent } from '../../logo/kcc20-token-logo/kcc20-token-logo.component';

@Component({
  selector: 'kcc20-asset-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe, UpperCasePipe, Kcc20TokenLogoComponent],
  templateUrl: './kcc20-asset-card.component.html',
  styleUrl: './kcc20-asset-card.component.scss',
})
export class Kcc20AssetCardComponent {
  holding = input<Kcc20Holding | undefined>(undefined);
}
