export enum KnsOperationType {
  INSCRIBE = 'inscribe',
  TRANSFER = 'transfer',
  UPDATE = 'update'
}

export interface KnsInscribe {
  p: 'kns';
  op: KnsOperationType.INSCRIBE;
  name: string;
  text?: {
    [key: string]: string;
  };
}

export interface KnsTransfer {
  p: 'kns';
  op: KnsOperationType.TRANSFER;
  name: string;
  to: string;
}

export interface KnsUpdate {
  p: 'kns';
  op: KnsOperationType.UPDATE;
  name: string;
  text: {
    [key: string]: string;
  };
}