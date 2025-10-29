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


    constructor() {
        toObservable(this.chainManager.getCurrentChainSignal()).subscribe(this.onNetworkChange.bind(this));
        toObservable(this.walletService.getCurrentWalletSignal()).subscribe(this.onNetworkChange.bind(this));
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
                blobGasUsed: receipt.gasUsed?.toString(),
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

    protected onNetworkChange() {
        this.transactionsHistorySignal.set([]);

        if (this.walletService.getCurrentWalletSignal()() && this.chainManager.getCurrentChainSignal()()) {
            this.loadTransactions();
        }
    }

    protected async loadTransactions() {
        const chainId = this.chainManager.getCurrentChainSignal()()!;
        const walletId = this.walletService.getCurrentWalletSignal()!()!.getIdWithAccount();

        const result = await this.db.transactionHistory
            .where('[chainId+walletId]')
            .equals([chainId, walletId])
            .toArray();

        const sortedResult = result.sort((a, b) => b.timestamp - a.timestamp);

        // remove if needed 
        if (result.length > MAX_TO_KEEP) {
            const toDelete = sortedResult.slice(-AMOUNT_TO_REMOVE).map(tx => tx.id!);

            // Remove them efficiently
            await this.db.transactionHistory.bulkDelete(toDelete);
        }

        this.transactionsHistorySignal.set(sortedResult);
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