export interface WalletAddressToken {
  tick: string;
  buri: string;
  tokenId: string;
  opScoreMod: string;
}

export interface WalletAddressTokensResponse {
  message: string;
  result: Array<WalletAddressToken>;
  next: string;
}


