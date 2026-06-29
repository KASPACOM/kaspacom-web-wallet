export enum KnsOperationType {
  CREATE = 'create',
  TRANSFER = 'transfer',
  UPDATE = 'update'
}

export interface KnsCreate {
  p?: 'domain'; // Only included if it's a domain
  op: KnsOperationType.CREATE;
  v: string;   // Domain/name value being created
  text?: {
    [key: string]: string;
  };
}

export interface KnsTransfer {
  p?: 'domain'; // Only included if it's a domain
  op: KnsOperationType.TRANSFER;
  id: string;   // Asset ID instead of name
  to: string;
}

export interface KnsUpdate {
  p?: 'domain'; // Only included if it's a domain
  op: KnsOperationType.UPDATE;
  id: string;   // Asset ID instead of name
  text: {
    [key: string]: string;
  };
}
