import { Signal, signal } from "@angular/core";
import { RpcClient } from "../../../public/kaspa/kaspa";
import { IMempoolResult, IMempoolResultEntry } from "../types/kaspa-network/mempool-result.interface";
import { UtxoChangedEvent } from "../types/kaspa-network/utxo-changed-event.interface";

export class MempoolTransactionManager {

    private walletMempoolTransactionsSignal = signal<IMempoolResultEntry | undefined>(undefined);
    private utxoChangedEventListenerWithBind: ((event: any) => void) | undefined =
        undefined;

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
    }

    async refreshMempoolTransactions() {
        const mempoolTransactions = await this.rpc.getMempoolEntriesByAddresses({
            addresses: [this.publicAddress],
            filterTransactionPool: false,
            includeOrphanPool: false,
        }) as any as IMempoolResult;

        const currentWalletEntries = mempoolTransactions.entries[0];

        this.walletMempoolTransactionsSignal.set(currentWalletEntries);
    }

    private utxoChangedEventListener(event: UtxoChangedEvent) {
        this.refreshMempoolTransactions();
    }

    getWalletMempoolTransactionsSignal(): Signal<IMempoolResultEntry | undefined> {
        return this.walletMempoolTransactionsSignal.asReadonly();
    }
}