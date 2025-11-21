/**
 * L1 Asset Type Enum
 * Follows DEVELOPMENT_RULES.md - enums instead of union types
 * 
 * Defines the types of assets available on Kaspa L1
 */
export enum L1AssetType {
  /** KRC20 tokens (fungible tokens) */
  KRC20 = 'krc20',
  
  /** KRC721 NFTs (non-fungible tokens) */
  KRC721 = 'krc721',
  
  /** KNS domains (Kaspa Name Service) */
  KNS = 'kns'
}

