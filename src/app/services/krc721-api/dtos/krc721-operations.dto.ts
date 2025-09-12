export enum Krc721OperationType {
  DEPLOY = 'deploy',
  MINT = 'mint',
  TRANSFER = 'transfer'
}

export interface Krc721Deploy {
  p: 'krc-721';
  op: Krc721OperationType.DEPLOY;
  tick: string;
  max: string;
  lim?: string;
  pre?: string;
  to?: string;
  dec?: string;
  sch?: string;
  buri?: string;
  st?: string;
}

export interface Krc721Mint {
  p: 'krc-721';
  op: Krc721OperationType.MINT;
  tick: string;
  to?: string;
}

export interface Krc721Transfer {
  p: 'krc-721';
  op: Krc721OperationType.TRANSFER;
  tick: string;
  to: string;
  tid: string;
}

export interface Krc721OperationBase {
  p: 'krc-721';
  deployer: string;
  tick: string;
  opScore: string;
  txIdRev: string;
  mtsAdd: string;
  opError?: string;
  feeRev: string;
}

export interface Krc721DeployOperation extends Krc721OperationBase {
  op: Krc721OperationType.DEPLOY;
  opData: Omit<Krc721Deploy, 'p' | 'op' | 'tick'>;
}

export interface Krc721MintOperation extends Krc721OperationBase {
  op: Krc721OperationType.MINT;
  opData: Omit<Krc721Mint, 'p' | 'op' | 'tick'>;
}

export interface Krc721TransferOperation extends Krc721OperationBase {
  op: Krc721OperationType.TRANSFER;
  opData: Omit<Krc721Transfer, 'p' | 'op' | 'tick'>;
}

export type Krc721Operation = Krc721DeployOperation | Krc721MintOperation | Krc721TransferOperation;

export interface Krc721OperationsResponse {
  message: string;
  result: Krc721Operation[];
  next?: string;
  prev?: string;
}