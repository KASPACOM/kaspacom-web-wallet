export enum KnsOperationType {
  CREATE = 'create',
  TRANSFER = 'transfer',
  LIST = 'list',
  SEND = 'send'
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

export interface KnsList {
  p: 'domain';
  op: KnsOperationType.LIST;
  id: string;   // Asset ID
}

export interface KnsSend {
  op: KnsOperationType.SEND;
  id: string;   // Asset ID instead of name
}
