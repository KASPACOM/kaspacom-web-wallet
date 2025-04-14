export interface StatusResponse {
  status: string;
  version: string;
}

export interface CollectionListResponse {
  collections: Collection[];
  total: number;
}

export interface Collection {
  ticker: string;
  name: string;
  description: string;
  image: string;
  totalSupply: number;
}

export interface CollectionDataResponse extends Collection {
  owner: string;
  createdAt: number;
}

export interface TokenDetailsResponse {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  owner: string;
  collection: Collection;
  attributes?: {
    trait_type: string;
    value: string;
  }[];
}

export interface TokenOwnersResponse {
  owners: {
    address: string;
    count: number;
  }[];
  total: number;
}

export interface WalletAddressTokensResponse {
  tokens: TokenDetailsResponse[];
  total: number;
}

export interface WalletAddressCollectionTokensResponse {
  tokens: TokenDetailsResponse[];
  total: number;
}

export interface OperationDetailsResponse {
  txId: string;
  status: string;
  timestamp: number;
  details: any;
}

export interface TokenHistoryResponse {
  transfers: {
    from: string;
    to: string;
    timestamp: number;
    txId: string;
  }[];
  total: number;
}

export enum TokenHistoryDirection {
  ASC = 'asc',
  DESC = 'desc'
} 