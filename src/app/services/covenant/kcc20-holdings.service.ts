import { Injectable, inject } from '@angular/core';
import {
  Kcc20WalletBalancesApiService,
  WalletProviderTokenBalanceDto,
} from '../kcc20-api/kcc20-wallet-balances-api.service';

export interface Kcc20Holding {
  covenantId: string;
  ticker: string;
  name: string;
  balance: number;
  decimals: number;
  activeUtxos: number;
}

/**
 * Read-only KCC20 balance lookup, sourced from the KCC20 wallet-provider API.
 * `balance`/`activeUtxos` reflect only the native (spendable covenant UTXO)
 * side of the response — wrapped/orderbook balances aren't directly
 * transferable the same way, so they're left out of this read model.
 */
@Injectable({
  providedIn: 'root',
})
export class Kcc20HoldingsService {
  private walletBalancesApiService = inject(Kcc20WalletBalancesApiService);

  async listHoldings(
    identifiers: Array<string | undefined>,
  ): Promise<Kcc20Holding[]> {
    const safeIdentifiers = identifiers.filter(
      (value): value is string => !!value,
    );
    if (safeIdentifiers.length === 0) return [];

    const rowsByIdentifier = await Promise.all(
      safeIdentifiers.map((identifier) =>
        this.walletBalancesApiService.getOwnerBalances(identifier),
      ),
    );

    // Same-covenant hits across the address/pubkey-hash identifiers are the
    // same holding, not additional balance — last-write-wins, mirroring
    // how the Contracts dashboard dedupes indexer rows across identifiers.
    const byCovenantId = new Map<string, Kcc20Holding>();
    for (const rows of rowsByIdentifier) {
      for (const row of rows) {
        const holding = this.toHolding(row);
        if (holding) byCovenantId.set(holding.covenantId, holding);
      }
    }

    return Array.from(byCovenantId.values()).sort(
      (a, b) => b.balance - a.balance,
    );
  }

  private toHolding(
    row: WalletProviderTokenBalanceDto,
  ): Kcc20Holding | undefined {
    const covenantId = row.canonicalCovenantId || row.token?.covenantId;
    if (!covenantId) return undefined;

    const ticker = row.token?.ticker;
    if (!ticker) return undefined;

    const name = row.token?.name || ticker;
    const displayScale = Number(row.token?.tokenDisplayScale ?? 1);
    const rawAmount = row.nativeBalance?.amount;
    if (rawAmount === undefined) return undefined;

    const balance =
      displayScale > 0 ? Number(rawAmount) / displayScale : Number(rawAmount);
    if (!Number.isFinite(balance) || balance <= 0) return undefined;

    return {
      covenantId,
      ticker: String(ticker),
      name: String(name),
      balance,
      decimals:
        row.token?.decimals ?? this.decimalsFromScale(displayScale),
      activeUtxos: row.nativeBalance?.utxoCount ?? 0,
    };
  }

  private decimalsFromScale(displayScale: number): number {
    if (!Number.isFinite(displayScale) || displayScale <= 1) return 0;
    return Math.round(Math.log10(displayScale));
  }
}
