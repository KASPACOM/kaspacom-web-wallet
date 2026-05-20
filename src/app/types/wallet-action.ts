import { EIP1193RequestPayload, EIP1193RequestType, ProtocolScript, ProtocolScriptDataAndAddress, ProtocolType, PsktActionsEnum } from '@kaspacom/wallet-messages';
import { WalletActionResultWithError } from './wallet-action-result';
import { BaseCommunicationApp } from '../services/communication-service/communication-app/base-communication-app';


export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  COMPOUND_UTXOS = 'compound-utxos',
  SIGN_PSKT_TRANSACTION = 'buy-krc20-pskt',
  SIGN_MESSAGE = 'sign-message',
  COMMIT_REVEAL = 'commit-reveal',
  COVENANT_DEPLOY = 'deploy-covenant',
  COVENANT_SPEND = 'spend-covenant',
  COVENANT_COMPLETE_PARTIAL = 'complete-covenant-partial',
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
  [WalletActionType.COVENANT_DEPLOY]: CovenantDeployAction;
  [WalletActionType.COVENANT_SPEND]: CovenantSpendAction;
  [WalletActionType.COVENANT_COMPLETE_PARTIAL]: CovenantCompletePartialAction;
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

export enum WalletPsktSighashTypeEnum {
  All = 0,
  None = 1,
  Single = 2,
  AllAnyOneCanPay = 3,
  NoneAnyOneCanPay = 4,
  SingleAnyOneCanPay = 5,
}

export interface WalletPsktSignInput {
  index: number;
  sighashType?: WalletPsktSighashTypeEnum;
}

export interface SignPsktTransactionAction {
  psktTransactionJson: string;
  submitTransaction?: boolean;
  signOnly?: boolean;
  signInputs?: WalletPsktSignInput[];
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

export interface CovenantOutpointActionData {
  txid: string;
  vout: number;
}

export interface CovenantSpendOutputActionData {
  address: string;
  amount: bigint;
}

export interface CovenantDeployAction {
  compiledContractJson: string;
  amountSompi: bigint;
  contractName?: string;
}

export interface CovenantSpendAction {
  compiledContractJson: string;
  contractName?: string;
  outpoint: CovenantOutpointActionData;
  inputAmountSompi: bigint;
  functionName: string;
  outputs: CovenantSpendOutputActionData[];
  extraArgs?: Record<string, bigint>;
  covenantId?: string;
  useSenderFee?: boolean;
}

export interface CovenantCompletePartialAction {
  partialSpendJson: string;
  contractName?: string;
}

export interface SubmitTransactionAction {
  transactionJson: string;
}
