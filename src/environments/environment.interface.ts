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
  kaspaApiBaseurl: string;
  kaspaNetwork: string;
  allowedDomains: string[];
  allowedIframeDomains: string[],
  l2Configs: {
    kasplex: L2ConfigInterface,
  }
}