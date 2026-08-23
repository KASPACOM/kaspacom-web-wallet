import { WalletActionResult, WalletActionResultType } from "@kaspacom/wallet-messages";

export interface WalletActionResultWithError {
    success: boolean;
    errorCode?: number;
    result?: WalletActionResult;
}

export interface CompoundUtxosActionResult extends WalletActionResult {
    type: WalletActionResultType.CompoundUtxos;
    transactionId: string;
}

export interface CovenantDeployActionResult extends WalletActionResult {
    type: WalletActionResultType;
    txid: string;
    contractAddress: string;
    outpoint: {
        txid: string;
        vout: number;
    };
    covenantId?: string;
}

export interface CovenantSpendActionResult extends WalletActionResult {
    type: WalletActionResultType;
    txid: string;
    functionName: string;
    covenantId?: string;
}

export interface CovenantCompletePartialActionResult extends WalletActionResult {
    type: WalletActionResultType;
    txid: string;
    functionName: string;
}
