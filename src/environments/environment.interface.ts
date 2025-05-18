export interface L2ConfigInterface {
  l1PayloadPrefix?: string,
  chainId: number;
  name: string;
  network: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: string[];
    };
    public: {
      http: string[];
    };
  };
  blockExplorerUrls?: string[];
}

export interface Environment {
  isProduction: boolean;
  backendApiBaseurl: string;
  kasplexApiBaseurl: string;
  knsApiBaseurl: string;
  kaspaApiBaseurl: string;
  kaspaNetwork: string;
  allowedDomains: string[];
  allowedIframeDomains: string[],
  kasplexL2Config: {
    rpcUrl: string,
    chainId: number,
    name: string,
  },
  krc721Api: string,
  krc721CacheStreamUrl: string,
  isL2Enabled: boolean;
  l2Configs: {
    kasplex: L2ConfigInterface,
  }
}