export interface TokenDetails {
  tick: string;
  tokenId: string;
  owner: string;
  buri?: string;
}

export interface TokenDetailsResponse {
  message: string;
  result: TokenDetails;
}

