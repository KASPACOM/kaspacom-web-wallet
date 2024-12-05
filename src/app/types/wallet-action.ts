export type WalletAction = {
  type: WalletActionType;
  data: TransferKasAction | Krc20Action;
  priorityFee?: bigint;
};

export enum WalletActionType {
  TRANSFER_KAS = 'transfer-kas',
  KRC20_ACTION = 'krc20-action',
}

export type TransferKasAction = {
  amount: bigint;
  to: string;
  sendAll?: boolean;
};

export type Krc20Action = {
  amount: bigint;
  assetId: string;
};
