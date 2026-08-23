import { Signal, signal } from '@angular/core';
import { RpcClient } from '../../../public/kaspa/kaspa';
import {
  IMempoolResult,
  IMempoolResultEntry,
} from '../types/kaspa-network/mempool-result.interface';
import { UtxoChangedEvent } from '../types/kaspa-network/utxo-changed-event.interface';

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
  ) {
    this.utxoChangedEventListenerWithBind =
      this.utxoChangedEventListener.bind(this);
  }

  async init() {
    this.disposed = false;
    await this.rpc.subscribeUtxosChanged([this.publicAddress]);
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

  async refreshMempoolTransactions() {
    if (this.disposed) {
      return;
    }

    const mempoolTransactions = (await this.rpc.getMempoolEntriesByAddresses({
      addresses: [this.publicAddress],
      filterTransactionPool: false,
      includeOrphanPool: false,
    })) as any as IMempoolResult;

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
    void this.refreshMempoolTransactions();
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
