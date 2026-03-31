export interface LfgTokenResponse {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tags: Record<string, unknown>;
  logoURI: string;
  keywords: string[];
  tokens: LfgToken[];
}

export interface LfgToken {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  isNSFW: boolean;
  colorHex?: string;
  logoURI?: string;
}
