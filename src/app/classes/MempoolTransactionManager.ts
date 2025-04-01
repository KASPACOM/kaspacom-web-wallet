import { Signal, signal } from "@angular/core";
import { RpcClient } from "../../../public/kaspa/kaspa";
import { IMempoolResult, IMempoolResultEntry } from "../types/kaspa-network/mempool-result.interface";
import { UtxoChangedEvent } from "../types/kaspa-network/utxo-changed-event.interface";

export class MempoolTransactionManager {

    private walletMempoolTransactionsSignal = signal<IMempoolResultEntry | undefined>(undefined);
    private utxoChangedEventListenerWithBind: ((event: any) => void) | undefined =
        undefined;
    private transactionConfirmedPromise: Promise<void> | undefined;
    private transactionConfirmedResolve: (() => void) | undefined;

    constructor(
        private readonly rpc: RpcClient,
        private readonly publicAddress: string,
    ) {
        this.utxoChangedEventListenerWithBind = this.utxoChangedEventListener.bind(this);
    }

    async init() {
        this.rpc.subscribeUtxosChanged([this.publicAddress]);
        await this.rpc.addEventListener(this.utxoChangedEventListenerWithBind!);

        await this.refreshMempoolTransactions();
    }

    async dispose() {
        this.rpc.unsubscribeUtxosChanged([this.publicAddress]);
        this.rpc.removeEventListener(
            'utxos-changed',
            this.utxoChangedEventListenerWithBind
        );

        this.transactionConfirmedPromise = undefined;
        this.transactionConfirmedResolve = undefined;
    }

    async refreshMempoolTransactions() {
        const mempoolTransactions = await this.rpc.getMempoolEntriesByAddresses({
            addresses: [this.publicAddress],
            filterTransactionPool: false,
            includeOrphanPool: false,
        }) as any as IMempoolResult;

        const currentWalletEntries = mempoolTransactions.entries[0];

        console.log('MEMMM', currentWalletEntries);

        this.walletMempoolTransactionsSignal.set(currentWalletEntries);

        if (this.transactionConfirmedPromise && currentWalletEntries.sending.length == 0) {
            this.transactionConfirmedResolve!();
        }
    }

    private utxoChangedEventListener(event: UtxoChangedEvent) {
        this.refreshMempoolTransactions();
    }

    getWalletMempoolTransactionsSignal(): Signal<IMempoolResultEntry | undefined> {
        return this.walletMempoolTransactionsSignal.asReadonly();
    }

    waitForSendingTransactionsToBeConfirmed(): Promise<void> {
        if (!this.transactionConfirmedPromise) {
            this.transactionConfirmedPromise = new Promise((resolve) => {
                this.transactionConfirmedResolve = resolve;
            });
        }

        if (this.walletMempoolTransactionsSignal() && this.walletMempoolTransactionsSignal()!.sending.length == 0) {
            this.transactionConfirmedResolve!();
        }

        return this.transactionConfirmedPromise;
    }
}
