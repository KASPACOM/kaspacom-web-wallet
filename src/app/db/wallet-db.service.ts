import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { L2TransactionHistory } from './dtos/l2-transaction-history';
import { SavedERC20Token } from './dtos/saved-erc20-token';

@Injectable({
    providedIn: 'root',
})

export class WalletDB extends Dexie {
    transactionHistory!: Table<L2TransactionHistory, number>; // string = primary key type
    erc20Tokens!: Table<SavedERC20Token, [string, string]>;

    constructor() {
        super('wallet-db'); // Database name
        this.version(1).stores({
            transactionHistory: '++id, hash, transactionRequest, receiptInfo, timestamp, [chainId+walletId]', // id = primary key, hash = index
            erc20Tokens: '[address+chainId], chainId, name, symbol, decimals',
        });
    }
}

export const db = new WalletDB();
