import { Injectable, inject } from '@angular/core';
import {
  CovenantIndexerService,
  IndexerCovenantDetails,
} from './covenant-indexer.service';

export interface Kcc20Holding {
  covenantId: string;
  ticker: string;
  name: string;
  balance: number;
  decimals: number;
  activeUtxos: number;
}

const KCC20_TEMPLATE_NAME = 'KCC20';

/**
 * Read-only KCC20 balance lookup, sourced from the covenant indexer.
 * KCC20 tokens are covenant UTXOs (not KRC20-style inscriptions): the
 * indexer decodes each covenant's constructor/state, so ticker/name/amount
 * are all available without needing the token's compiled contract JSON —
 * that's only required to *spend* a covenant, not to read its state.
 */
@Injectable({
  providedIn: 'root',
})
export class Kcc20HoldingsService {
  private covenantIndexerService = inject(CovenantIndexerService);

  async listHoldings(
    identifiers: Array<string | undefined>,
  ): Promise<Kcc20Holding[]> {
    const safeIdentifiers = identifiers.filter(
      (value): value is string => !!value,
    );
    if (safeIdentifiers.length === 0) return [];

    const rowsByIdentifier = await Promise.all(
      safeIdentifiers.map((identifier) =>
        this.covenantIndexerService.listCovenants({
          wallet: identifier,
          template: KCC20_TEMPLATE_NAME,
          sort: 'recent',
          limit: 100,
        }),
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

  private toHolding(row: IndexerCovenantDetails): Kcc20Holding | undefined {
    const covenantId = row.covenantIdHex;
    if (!covenantId) return undefined;

    const constructorState = (row.constructor || {}) as Record<string, any>;
    const extension = (constructorState['extension'] || {}) as Record<
      string,
      any
    >;
    const claimedArgs = this.argsArrayToRecord(row.claimedArgs?.args);

    const ticker = extension['ticker'] || claimedArgs['ticker'];
    if (!ticker) return undefined;

    const name = extension['name'] || claimedArgs['name'] || ticker;
    const displayScale = Number(
      extension['displayScale'] ?? claimedArgs['displayScale'] ?? 1,
    );
    const rawAmount = constructorState['tokenAmount'];
    if (rawAmount === undefined) return undefined;

    const balance =
      displayScale > 0 ? Number(rawAmount) / displayScale : Number(rawAmount);
    if (!Number.isFinite(balance) || balance <= 0) return undefined;

    return {
      covenantId,
      ticker: String(ticker),
      name: String(name),
      balance,
      decimals: this.decimalsFromScale(displayScale),
      activeUtxos: row.activeUtxos ?? 0,
    };
  }

  private decimalsFromScale(displayScale: number): number {
    if (!Number.isFinite(displayScale) || displayScale <= 1) return 0;
    return Math.round(Math.log10(displayScale));
  }

  private argsArrayToRecord(
    args?: Array<{ name: string; value: string }>,
  ): Record<string, string> {
    const record: Record<string, string> = {};
    for (const arg of args || []) {
      if (arg?.name) record[arg.name] = arg.value;
    }
    return record;
  }
}
