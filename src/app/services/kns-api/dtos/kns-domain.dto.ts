export interface KnsDomainAsset {
  id: string;
  assetId: string;
  mimeType: string;
  asset: string;
  owner: string;
  creationBlockTime: string;
  isDomain: boolean;
  isVerifiedDomain: boolean;
  status: string;
  transactionId: string;
}

export interface KnsDomainPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface KnsDomainsResponse {
  data: {
    assets: KnsDomainAsset[];
    pagination: KnsDomainPagination;
  };
}

export interface KnsDomainResponse {
  data: KnsDomainAsset;
}

export interface KnsDomainOwnerInfo {
  owner: string;
  asset: string;
  assetId: string;
  txid: string;
  blockTime: number;
  text?: {
    [key: string]: string;
  };
}

export interface KnsDomainOwnerResponse {
  data: KnsDomainOwnerInfo;
}

export interface KnsDomainCheckRequest {
  address: string;
  domainNames: string[];
}

export interface KnsDomainCheckResult {
  domain: string;
  available: boolean;
  reason?: string;
}

export interface KnsDomainCheckResponse {
  data: KnsDomainCheckResult[];
}

export enum KnsWalletAssetsStatus {
  ACTIVE = 'active',
  LISTED = 'listed',
  EXPIRED = 'expired'
}

export type KnsDomainCollection = 'kaspa' | 'kasplex' | 'nacho' | 'spectre' | 'chacha';