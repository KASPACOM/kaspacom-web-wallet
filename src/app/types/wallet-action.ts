import { KRC20OperationDataInterface } from './kaspa-network/krc20-operations-data.interface';
import { WalletActionResultWithError } from './wallet-action-result';

export interface WalletAction {
  type: WalletActionType;
  data:
    | TransferKasAction
    | Krc20Action
    | CompoundUtxosAction
    | BuyKrc20PsktAction
    | SignMessage;
  priorityFee?: bigint;
}

export interface WalletActionListItem {
  action: WalletAction;
  promise: Promise<WalletActionResultWithError>;
  resolve: (result: WalletActionResultWithError) => void;
  reject: (error: any) => void;
  notifyUpdate: (transactionId: string) => Promise<any>;
}

export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  KRC20_ACTION = 'krc20-action',
  COMPOUND_UTXOS = 'compound-utxos',
  BUY_KRC20_PSKT = 'buy-krc20-pskt',
  SIGN_MESSAGE = 'sign-message',
}

export interface TransferKasAction {
  amount: bigint;
  to: string;
  sendAll?: boolean;
}

export interface CompoundUtxosAction {}

export interface Krc20Action {
  operationData: KRC20OperationDataInterface;
  revealOnly?: boolean;
  isCancel?: boolean;
  transactionId?: string;
  amount?: bigint;
  psktData?: ActionWithPsktGenerationData;
}

export interface ActionWithPsktGenerationData {
  totalPrice: bigint;
  commission?: {
    address: string;
    amount: bigint;
  };
}

export interface BuyKrc20PsktAction {
  psktTransactionJson: string;
  signOnly: boolean;
}

export interface SignMessage {
  message: string;
}
