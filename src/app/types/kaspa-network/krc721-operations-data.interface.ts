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
  tokenId: string;
}