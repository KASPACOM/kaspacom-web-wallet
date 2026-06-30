export interface INft {
  tick: string; // Collection ticker/name
  tokenId: string; // Unique token ID
  owner: string; // Owner address
  name?: string; // NFT name from metadata
  description?: string; // NFT description from metadata
  image?: string; // NFT image URL from metadata
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  // Rarity info
  rarityRank?: number;
  legendary?: boolean;
  totalSupply?: number;
  isListed?: boolean;
}

// Extended interface for NFTs with metadata loading state
export interface INftWithMetadata extends INft {
  isLoadingMetadata?: boolean;
  metadataLoaded?: boolean;
}
