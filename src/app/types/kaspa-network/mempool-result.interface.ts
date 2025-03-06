import { ITransaction } from "../../../../public/kaspa/kaspa";

export type IMempoolResultTransactionData =
    {
        fee: bigint;
        transaction: ITransaction;
        is_orphan: boolean;
    }

export interface IMempoolResult {
    entries: IMempoolResultEntry[];
}

export interface IMempoolResultEntry {
    address: string;
    sending: IMempoolResultTransactionData[];
    receiving: IMempoolResultTransactionData[];
}