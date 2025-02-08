import { WalletActionResult, WalletActionResultType } from "kaspacom-wallet-messages";
import { KRC20OperationDataInterface } from "./kaspa-network/krc20-operations-data.interface";
import { ActionWithPsktGenerationData } from "./wallet-action";
import { KaspaScriptProtocolType } from "./kaspa-network/kaspa-script-protocol-type.enum";

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

export interface CommitRevealActionResult extends WalletActionResult {
    type: WalletActionResultType.CommitReveal;
    commitTransactionId: string;
    revealTransactionId: string;
    protocol: KaspaScriptProtocolType;
    protocolAction: string;
    revealPsktJson?: string;
    
}
