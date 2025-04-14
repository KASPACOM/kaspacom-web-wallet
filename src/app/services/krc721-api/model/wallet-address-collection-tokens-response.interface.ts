export interface WalletAddressCollectionTokenInfo {
  tick: string;
  tokenId: string;
  opScoreMod: string;
}

export interface WalletAddressCollectionTokensResponse {
  message: string;
  result: WalletAddressCollectionTokenInfo[];
  next?: number;
}

