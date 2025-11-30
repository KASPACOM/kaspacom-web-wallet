export interface Krc721Metadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface Krc721Nft {
  tick: string;
  tokenId: string;
  owner: string;
  buri?: string;
  metadata?: Krc721Metadata;
  // Portfolio API additions
  rarityRank?: number;
  legendary?: boolean;
  totalSupply?: number;
  rawTraits?: Record<string, any>;
}

export interface Krc721NftResponse {
  message: string;
  result: Krc721Nft;
}

export interface Krc721NftsResponse {
  message: string;
  result: Krc721Nft[];
  next?: number;
  prev?: number;
}

export interface Krc721TokenOwner {
  tick: string;
  tokenId: string;
  owner: string;
  opScoreMod: string;
}

export interface Krc721TokenOwnersResponse {
  message: string;
  result: Krc721TokenOwner[];
  next?: number;
  prev?: number;
}