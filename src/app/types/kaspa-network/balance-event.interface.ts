export interface BalanceData {
    mature: bigint;
    pending: bigint;
    outgoing: bigint;
    matureUtxoCount: number;
    pendingUtxoCount: number;
    stasisUtxoCount: number;
}

export interface BalanceEvent {
    type: string; // "balance"
    data: {
        balance: BalanceData;
        id: string;
    };
}
