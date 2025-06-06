import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { IToken } from '../../../common/interfaces/token.interface';
import { TokenLogoComponent } from '../../../common/token-logo/token-logo.component';

@Component({
  selector: 'app-search-token-card',
  imports: [TokenLogoComponent, DecimalPipe, TitleCasePipe, KcIconComponent],
  templateUrl: './search-token-card.component.html',
  styleUrl: './search-token-card.component.scss',
})
export class SearchTokenCardComponent {
  token = input<IToken>();

  profitTendency = computed(() => 3.23344332);

  profitTendencyClass = computed(() => {
    const value = this.profitTendency();
    if (!value) return 'neutral';
    if (value > 0) return 'up';
    return 'down';
  });

  doSomething() {}
}
