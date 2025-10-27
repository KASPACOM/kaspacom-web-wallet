export interface IToken {
  name: string;
  symbol: string;
  address: string;
  balance: number;
  priceKas: number;
  decimals?: number; // Number of decimal places for the token
}

// Extended interface for tokens with metadata
export interface ITokenWithMetadata extends IToken {
  maxSupply?: string;
  holders?: string;
  state?: string;
  isLoadingMetadata?: boolean;
}
