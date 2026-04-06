import { inject, Injectable, Signal, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Transaction } from "ethers";
import { WalletDB } from "../../db/wallet-db.service";
import { EthereumWalletChainManager } from "../etherium-services/etherium-wallet-chain.manager";
import { AssetsManagerService } from "../assets-manager/assets-manager.service";
import { L2TransactionHistory, L2TransactionHistoryReceiptInfo } from "../../db/dtos/l2-transaction-history";
import { WalletService } from "../wallet.service";

const MAX_TO_KEEP = 100;
const AMOUNT_TO_REMOVE = 10;

@Injectable({
    providedIn: 'root'
})
export class L2TransactionHistoryService {
    protected db = inject(WalletDB);
    protected chainManager = inject(EthereumWalletChainManager);
    protected walletService = inject(WalletService);
    protected assetsManagerService = inject(AssetsManagerService);


    protected transactionsHistorySignal = signal<L2TransactionHistory[]>([]);
    private readonly transactionHistoryLoading = signal(false);
    private historyReloadGeneration = 0;

    constructor() {
        toObservable(this.chainManager.getCurrentChainSignal()).subscribe(() => {
            void this.scheduleHistoryReload();
        });
        toObservable(this.walletService.getCurrentWalletSignal()).subscribe(() => {
            void this.scheduleHistoryReload();
        });
    }

    getTransactionHistoryLoadingSignal(): Signal<boolean> {
        return this.transactionHistoryLoading.asReadonly();
    }

    private scheduleHistoryReload(): void {
        void this.reloadHistory();
    }

    private async reloadHistory(): Promise<void> {
        const gen = ++this.historyReloadGeneration;
        this.transactionHistoryLoading.set(true);
        this.transactionsHistorySignal.set([]);

        const wallet = this.walletService.getCurrentWalletSignal()();
        const chainId = this.chainManager.getCurrentChainSignal()();
        try {
            if (!wallet || !chainId) {
                return;
            }
            await this.loadTransactions(gen);
        } finally {
            if (gen === this.historyReloadGeneration) {
                this.transactionHistoryLoading.set(false);
            }
        }
    }

    async addTransactionAndWaitForResult(signedTransactionRequest: string) {
        try {
            const wallet = this.walletService.getCurrentWalletSignal()()!;
            const transactionData = Transaction.from(signedTransactionRequest);

            const tranasctionHistoryEntity: L2TransactionHistory = {
                hash: transactionData.hash!,
                walletId: wallet.getIdWithAccount(),
                transactionData: transactionData.unsignedSerialized,
                timestamp: Date.now(),
                chainId: this.chainManager.getCurrentChainSignal()()!,
            };

            const id = await this.db.transactionHistory.add(tranasctionHistoryEntity);

            this.transactionsHistorySignal.set([tranasctionHistoryEntity, ...this.transactionsHistorySignal()]);

            await this.getReceiptForUnfinishedTransactionAndSave(tranasctionHistoryEntity.hash, id);

        } catch (e) {
            console.error('Error adding transaction to history');
            console.error(e);
        }

    }

    protected async getReceiptForUnfinishedTransactionAndSave(hash: string, id: number): Promise<void> {
        const receipt = await this.chainManager.getCurrentWalletProvider()?.getTransactionReceipt(hash!);

        if (receipt) {
            const receiptInfo: L2TransactionHistoryReceiptInfo = {
                contractAddress: receipt.contractAddress || undefined,
                index: receipt.index,
                blockHash: receipt.blockHash,
                blockNumber: receipt.blockNumber,
                gasUsed: String(receipt.gasUsed),
                blobGasUsed: receipt.blobGasUsed?.toString(),
                gasPrice: String(receipt.gasPrice),
                blobGasPrice: receipt.blobGasPrice?.toString(),
                type: receipt.type,
                status: receipt.status || 0,
                fee: String(receipt.fee),
            };
            this.db.transactionHistory.update(id, {
                receiptInfo,
            });
            this.transactionsHistorySignal.set(this.transactionsHistorySignal().map((item) => item.id === id ? { ...item, receiptInfo } : item));

            this.assetsManagerService.reloadAllCurrentAssetsAfterUpdate();
        }
    }

    getInfoFromTransactionData(transactionData: string): Transaction {
        return Transaction.from(transactionData);
    }

    protected async loadTransactions(expectedGen: number) {
        const chainId = this.chainManager.getCurrentChainSignal()()!;
        const walletId = this.walletService.getCurrentWalletSignal()!()!.getIdWithAccount();

        const result = await this.db.transactionHistory
            .where('[chainId+walletId]')
            .equals([chainId, walletId])
            .toArray();

        if (expectedGen !== this.historyReloadGeneration) {
            return;
        }

        const sortedResult = result.sort((a, b) => b.timestamp - a.timestamp);

        let rows = sortedResult;
        if (result.length > MAX_TO_KEEP) {
            const toDelete = sortedResult.slice(-AMOUNT_TO_REMOVE).map(tx => tx.id!);
            await this.db.transactionHistory.bulkDelete(toDelete);
            const deleteSet = new Set(toDelete);
            rows = sortedResult.filter((tx) => tx.id !== undefined && !deleteSet.has(tx.id));
        }

        if (expectedGen !== this.historyReloadGeneration) {
            return;
        }

        this.transactionsHistorySignal.set(rows);
        this.getReceiptForUnfinishedTransaction();
    }

    protected getReceiptForUnfinishedTransaction() {
        const unfinishedTransactions = this.transactionsHistorySignal().filter((item) => !item.receiptInfo);

        for (const transaction of unfinishedTransactions) {
            this.getReceiptForUnfinishedTransactionAndSave(transaction.hash, transaction.id!);
        }
    }

    getTransactionHistorySignal(): Signal<L2TransactionHistory[]> {
        return this.transactionsHistorySignal.asReadonly();
    }

}