import { KRC20OperationDataInterface } from "./kaspa-network/krc20-operations-data.interface";

export interface WalletAction {
  type: WalletActionType;
  data: TransferKasAction | Krc20Action;
  priorityFee?: bigint;
};

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