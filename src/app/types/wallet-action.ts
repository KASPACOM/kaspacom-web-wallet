import { ProtocolScript, ProtocolScriptDataAndAddress, PsktActionsEnum } from 'kaspacom-wallet-messages';
import { WalletActionResultWithError } from './wallet-action-result';
import { ProtocolType } from 'kaspacom-wallet-messages/dist/types/protocol-type.enum';


export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  COMPOUND_UTXOS = 'compound-utxos',
  SIGN_PSKT_TRANSACTION = 'buy-krc20-pskt',
  SIGN_MESSAGE = 'sign-message',
  COMMIT_REVEAL = 'commit-reveal',
}

// Mapping action types to their specific data shapes
type WalletActionDataMap = {
  [WalletActionType.TRANSFER_KAS]: TransferKasAction;
  [WalletActionType.COMPOUND_UTXOS]: CompoundUtxosAction;
  [WalletActionType.SIGN_PSKT_TRANSACTION]: SignPsktTransactionAction;
  [WalletActionType.SIGN_MESSAGE]: SignMessage;
  [WalletActionType.COMMIT_REVEAL]: CommitRevealAction;
};

// Generic WalletAction type
export type WalletAction = {
  [K in keyof WalletActionDataMap]: {
    type: K;
    data: WalletActionDataMap[K];
    priorityFee?: bigint;
  };
}[keyof WalletActionDataMap];


export interface WalletActionListItem {
  action: WalletAction;
  promise: Promise<WalletActionResultWithError>;
  resolve: (result: WalletActionResultWithError) => void;
  reject: (error: any) => void;
  notifyUpdate: (transactionId: string) => Promise<any>;
}


export interface TransferKasAction {
  amount: bigint;
  to: string;
  sendAll?: boolean;
}

export interface CompoundUtxosAction { }

export interface ActionWithPsktGenerationData {
  totalPrice: bigint;
  commission?: {
    address: string;
    amount: bigint;
  };
}

export interface SignPsktTransactionAction {
  psktTransactionJson: string;
  submitTransaction?: boolean;
  protocol?: ProtocolType | string;
  type?: PsktActionsEnum | string;
}

export interface SignMessage {
  message: string;
}

export interface CommitRevealAction {
  actionScript: ProtocolScript;
  options?: {
    revealPriorityFee?: bigint;
    additionalOutputs?: { address: string; amount: bigint }[];
    commitTransactionId?: string;
    revealPskt?: {
      outputs?: {
        address: string;
        amount: bigint;
      }[];
      script: ProtocolScriptDataAndAddress,
    }
  };
}
