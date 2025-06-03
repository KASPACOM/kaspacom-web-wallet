import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';

@Component({
  selector: 'app-balance',
  imports: [DecimalPipe],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss',
})
export class BalanceComponent {
  usdBalance = computed(() => 13.45);
  usdProfit = computed(() => 0.0287);
  absUsdProfit = computed(() => Math.abs(this.usdProfit()));
  profitSign = computed(() => {
    if (!this.usdProfit()) {
      return '';
    }
    return this.usdProfit() > 0 ? '+' : '-';
  });
  profitTextClass = computed(() => {
    if (!this.usdProfit()) {
      return 'text-white';
    }
    return this.usdProfit() > 0 ? 'text-green-20' : 'text-red-20';
  });
  percentProfit = computed(() => 0.21);
}
