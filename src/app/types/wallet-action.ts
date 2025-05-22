import { EIP1193RequestPayload, EIP1193RequestType, ProtocolScript, ProtocolScriptDataAndAddress, PsktActionsEnum } from '@kaspacom/wallet-messages';
import { WalletActionResultWithError } from './wallet-action-result';
import { ProtocolType } from '@kaspacom/wallet-messages/dist/types/protocol-type.enum';
import { BaseCommunicationApp } from '../services/communication-service/communication-app/base-communication-app';


export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  COMPOUND_UTXOS = 'compound-utxos',
  SIGN_PSKT_TRANSACTION = 'buy-krc20-pskt',
  SIGN_MESSAGE = 'sign-message',
  COMMIT_REVEAL = 'commit-reveal',
  SUBMIT_TRANSACTION = 'submit-transaction',
  EIP1193_PROVIDER_REQUEST = 'eip-1193-provider-request',
  APPROVE_COMMUNICATION_APP = 'approve-communication-app',
}

// Mapping action types to their specific data shapes
type WalletActionDataMap = {
  [WalletActionType.TRANSFER_KAS]: TransferKasAction;
  [WalletActionType.COMPOUND_UTXOS]: CompoundUtxosAction;
  [WalletActionType.SIGN_PSKT_TRANSACTION]: SignPsktTransactionAction;
  [WalletActionType.SIGN_MESSAGE]: SignMessage;
  [WalletActionType.COMMIT_REVEAL]: CommitRevealAction;
  [WalletActionType.EIP1193_PROVIDER_REQUEST]: EIP1193RequestPayload<EIP1193RequestType>;
  [WalletActionType.APPROVE_COMMUNICATION_APP]: BaseCommunicationApp;
};

// Generic WalletAction type
export type WalletAction = {
  [K in keyof WalletActionDataMap]: {
    type: K;
    data: WalletActionDataMap[K];
    priorityFee?: bigint;
    rbf?: boolean;
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

export interface SubmitTransactionAction {
  transactionJson: string;
}