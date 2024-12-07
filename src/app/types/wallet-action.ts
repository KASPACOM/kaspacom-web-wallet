import { AppWallet } from "../classes/AppWallet";
import { KRC20OperationDataInterface } from "./kaspa-network/krc20-operations-data.interface";
import { WalletActionResultWithError } from "./wallet-action-result";

export interface WalletAction {
  type: WalletActionType;
  data: TransferKasAction | Krc20Action;
  priorityFee?: bigint;
};

export interface WalletActionListItem {
  action: WalletAction;
  promise: Promise<WalletActionResultWithError>;
  resolve: (result: WalletActionResultWithError) => void;
  reject: (error: any) => void;
  wallet: AppWallet;
  notifyUpdate: (transactionId: string) => Promise<any>;
}

export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  KRC20_ACTION = 'krc20-action',
}

export interface TransferKasAction {
  amount: bigint;
  to: string;
  sendAll?: boolean;
};

export interface Krc20Action {
  operationData: KRC20OperationDataInterface;
}