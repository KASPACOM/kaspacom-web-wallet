export interface DexApiToken {
  id: string;
  name: string;
  symbol: string;
  decimals: string;
  totalSupply: string;
  tokenPriceUSD: number;
  marketCapUSD: number;
  logoURI?: string;
  holders?: number;
}

export interface DexApiTokensResponse {
  tokens: DexApiToken[];
}
