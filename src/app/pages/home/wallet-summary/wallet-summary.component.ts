import { Component, signal } from '@angular/core';
import { IToken } from '../../../interfaces/token.interface';
import { TokenLogoComponent } from '../../../components/token-logo/token-logo.component';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-wallet-summary',
  imports: [TokenLogoComponent, DecimalPipe, UpperCasePipe, TitleCasePipe],
  templateUrl: './wallet-summary.component.html',
  styleUrl: './wallet-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class WalletSummaryComponent {
  tokens = signal<IToken[]>([
    {
      name: 'ghoad',
      symbol: 'GHOAD',
      address: '0x0',
      balance: 2000,
      usdPrice: 0.02,
    },
    {
      name: 'pluto',
      symbol: 'PLUTO',
      address: '0x0',
      balance: 1000,
      usdPrice: 0.0000022,
    },
    {
      name: 'KACHI',
      symbol: 'KACHI',
      address: '0x0',
      balance: 10,
      usdPrice: 0.12,
    },
    {
      name: 'ZEAL',
      symbol: 'ZEAL',
      address: '0x0',
      balance: 124.45432,
      usdPrice: 0.03,
    },
    {
      name: 'CRUMBS',
      symbol: 'CRUMBS',
      address: '0x0',
      balance: 300434,
      usdPrice: 0.01,
    },
  ]);
}
