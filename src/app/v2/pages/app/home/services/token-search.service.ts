import { Injectable, signal } from '@angular/core';
import { IToken } from '../../common/interfaces/token.interface';
import { delay, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TokenSearchService {
  currentQuery = signal<string>('');
  suggestions = signal<IToken[]>([]);
  mockTokens = signal<IToken[]>([
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

  constructor() {}

  searchToken(query: string) {
    const filtered = this.mockTokens().filter(
      (token) =>
        query &&
        (token.name.toLowerCase().includes(query.toLowerCase()) ||
          token.symbol.toLowerCase().includes(query.toLowerCase())),
    );
    return of(filtered).pipe(delay(500));
  }
}
