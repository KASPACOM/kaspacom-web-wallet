import { WalletActionResult, WalletActionResultType } from "kaspacom-wallet-messages";

export interface WalletActionResultWithError {
    success: boolean;
    errorCode?: number;
    result?: WalletActionResult;
}

export interface CompoundUtxosActionResult extends WalletActionResult {
    type: WalletActionResultType.CompoundUtxos;
    transactionId: string;
}

export interface SignPsktTransactionActionResult extends WalletActionResult {
    type: WalletActionResultType.SignPsktTransaction;
    transactionId?: string;
    psktTransactionJson: string;
}

export interface SignedMessageActionResult extends WalletActionResult {
    type: WalletActionResultType.MessageSigning;
    originalMessage: string;
    signedMessage: string;
    publicKey: string;
}
