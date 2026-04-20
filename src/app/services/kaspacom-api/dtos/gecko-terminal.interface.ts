export interface GeckoOhlcvEntry {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GeckoOhlcvResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][];
    };
  };
}

export interface GeckoTokenPool {
  address: string;
  name: string;
  reserveInUsd: string;
  baseTokenPriceUsd: string;
  priceChangeH24: string | null;
}

export interface GeckoTokenPoolsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      base_token_price_usd: string;
      quote_token_price_usd: string;
      reserve_in_usd: string;
      price_change_percentage: {
        h1?: string;
        h24?: string;
      };
    };
  }>;
}

export interface TokenPriceChangeStats {
  h24: number | null;
  d7: number | null;
  d30: number | null;
}
