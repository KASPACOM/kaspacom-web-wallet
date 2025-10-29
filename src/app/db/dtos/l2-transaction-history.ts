export interface L2TransactionHistoryReceiptInfo {
    contractAddress?: string;
    index: number;
    blockHash: string;
    blockNumber: number;
    gasUsed: string;
    blobGasUsed?: string;
    gasPrice: string;
    blobGasPrice?: string;
    type: number;
    status: number;
    fee: string;
}

export interface L2TransactionHistory {
    id?: number;
    hash: string;
    walletId: string;
    transactionData: string;
    receiptInfo?: L2TransactionHistoryReceiptInfo;
    timestamp: number;
    chainId: string;
}