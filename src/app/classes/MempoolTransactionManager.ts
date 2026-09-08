import { Signal, signal } from '@angular/core';
import { RpcClient } from '../../../public/kaspa/kaspa';
import {
  IMempoolResult,
  IMempoolResultEntry,
} from '../types/kaspa-network/mempool-result.interface';
import { UtxoChangedEvent } from '../types/kaspa-network/utxo-changed-event.interface';

export type KaspaRpcErrorHandler = (
  error: unknown,
  method: string,
  handled: boolean,
) => Error;

export class MempoolTransactionManager {
  private walletMempoolTransactionsSignal = signal<
    IMempoolResultEntry | undefined
  >(undefined);
  private utxoChangedEventListenerWithBind: ((event: any) => void) | undefined =
    undefined;
  private transactionConfirmedPromise: Promise<void> | undefined;
  private transactionConfirmedResolve: (() => void) | undefined;
  private disposed = false;

  constructor(
    private readonly rpc: RpcClient,
    private readonly publicAddress: string,
    private readonly onRpcError?: KaspaRpcErrorHandler,
  ) {
    this.utxoChangedEventListenerWithBind =
      this.utxoChangedEventListener.bind(this);
  }

  async init() {
    this.disposed = false;
    await this.runRpcOperation('subscribeUtxosChanged', () =>
      this.rpc.subscribeUtxosChanged([this.publicAddress]),
    );
    await this.rpc.addEventListener(this.utxoChangedEventListenerWithBind!);

    await this.refreshMempoolTransactions();
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    if (this.utxoChangedEventListenerWithBind) {
      this.rpc.removeEventListener(
        'utxos-changed',
        this.utxoChangedEventListenerWithBind,
      );
    }

    try {
      await this.rpc.unsubscribeUtxosChanged([this.publicAddress]);
    } catch (err) {
      console.warn('Failed to unsubscribe UTXO changes', err);
    }

    this.transactionConfirmedPromise = undefined;
    this.transactionConfirmedResolve = undefined;
  }

  async refreshMempoolTransactions(handled = false) {
    if (this.disposed) {
      return;
    }

    const mempoolTransactions = (await this.runRpcOperation(
      'getMempoolEntriesByAddresses',
      () =>
        this.rpc.getMempoolEntriesByAddresses({
          addresses: [this.publicAddress],
          filterTransactionPool: false,
          includeOrphanPool: false,
        }),
      handled,
    )) as any as IMempoolResult;

    const currentWalletEntries = mempoolTransactions.entries[0];

    this.walletMempoolTransactionsSignal.set(currentWalletEntries);

    if (
      this.transactionConfirmedPromise &&
      currentWalletEntries.sending.length == 0
    ) {
      this.transactionConfirmedResolve!();
    }
  }

  private utxoChangedEventListener(event: UtxoChangedEvent) {
    this.refreshMempoolTransactionsInBackground();
  }

  refreshMempoolTransactionsInBackground(): void {
    void this.refreshMempoolTransactions(true).catch(() => undefined);
  }

  private async runRpcOperation<T>(
    method: string,
    operation: () => Promise<T>,
    handled = false,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.onRpcError?.(error, method, handled) ?? error;
    }
  }

  getWalletMempoolTransactionsSignal(): Signal<
    IMempoolResultEntry | undefined
  > {
    return this.walletMempoolTransactionsSignal.asReadonly();
  }

  waitForSendingTransactionsToBeConfirmed(): Promise<void> {
    if (!this.transactionConfirmedPromise) {
      this.transactionConfirmedPromise = new Promise((resolve) => {
        this.transactionConfirmedResolve = resolve;
      });
    }

    if (
      this.walletMempoolTransactionsSignal() &&
      this.walletMempoolTransactionsSignal()!.sending.length == 0
    ) {
      this.transactionConfirmedResolve!();
    }

    return this.transactionConfirmedPromise;
  }
}
