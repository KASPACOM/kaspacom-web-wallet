import { TN10 } from '../fixtures/network';

export interface TxRecord {
  transaction_id?: string;
  block_time?: number;
  is_accepted?: boolean;
  accepting_block_hash?: string | null;
}

/**
 * Poll the TN10 block-explorer API for a transaction. Resolves when the tx
 * is observed, rejects after `timeoutMs` (default 60s).
 *
 * Endpoint docs: https://api-tn10.kaspa.org/docs#/
 */
export async function waitForTxConfirmed(
  txId: string,
  opts: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<TxRecord> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `${TN10.kaspaApiBaseurl}/transactions/${encodeURIComponent(txId)}`,
      );
      if (res.ok) {
        const body = (await res.json()) as TxRecord;
        if (body.is_accepted) return body;
        // Observed but not yet accepted — keep polling
      } else if (res.status !== 404) {
        lastErr = new Error(`explorer ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(
    `tx ${txId} not accepted within ${timeoutMs}ms (last error: ${String(lastErr ?? 'none')})`,
  );
}
