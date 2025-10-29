import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { L2TransactionHistory } from './dtos/l2-transaction-history';

@Injectable({
    providedIn: 'root',
})

export class WalletDB extends Dexie {
    transactionHistory!: Table<L2TransactionHistory, number>; // string = primary key type

    constructor() {
        super('wallet-db'); // Database name
        this.version(1).stores({
            transactionHistory: '++id, hash, transactionRequest, receiptInfo, timestamp, [chainId+walletId]', // id = primary key, hash = index
        })
    }
}

export const db = new WalletDB();
