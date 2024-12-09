import { KRC20OperationDataInterface } from "./kaspa-network/krc20-operations-data.interface";

export enum WalletActionResultType {
    KasTransfer = 'kas-transfer',
    Krc20Action = 'krc20action',
    MessageSigning = 'message-signing',
    CompoundUtxos = 'compound-utxos',
}

export interface WalletActionResult {
    performedByWallet: string;
    type: WalletActionResultType;
}

export interface WalletActionResultWithError {
    success: boolean;
    errorCode?: number;
    result?: WalletActionResult;
}

export interface KasTransferActionResult extends WalletActionResult {
    type: WalletActionResultType.KasTransfer;
    to: string;
    amount: bigint;
    sendAll?: boolean;
    transactionId: string;
}

export interface CompoundUtxosActionResult extends WalletActionResult {
    type: WalletActionResultType.CompoundUtxos;
    transactionId: string;
}

export interface Krc20ActionResult extends WalletActionResult {
    type: WalletActionResultType.Krc20Action;
    ticker: string;
    commitTransactionId: string;
    revealTransactionId: string;
    operationData: KRC20OperationDataInterface;
}

export interface MessageSigningActionResult extends WalletActionResult {
    type: WalletActionResultType.MessageSigning;
    message: string;
    encryptedSignedMessage: string;
}

