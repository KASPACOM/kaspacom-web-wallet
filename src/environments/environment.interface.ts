export interface L2CustomChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  nativeToken: {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  defiApiNetworkName?: string;
  wrappedTokenAddress?: string;
}

export interface L2ConfigInterface {
  /** SDK network key — used only by the swap flow to initialize the swap controller */
  sdkName: string;
  icon: string;
  l1TransactionPrefix?: string;
  /** Chain config for wallet operations (RPC, chain ID, explorer, native token). Required for all L2 chains. */
  customChainConfig: L2CustomChainConfig;
}

export interface Environment {
  isProduction: boolean;
  segmentKey?: string;
  clarityKey?: string;
  addressableKey?: string;
  consentScriptUrl?: string;
  consentCssUrl?: string;
  kaspaComApiBaseurl: string;
  kaspaComDefiApiBaseurl: string;
  kasplexApiBaseurl: string;
  kaspaApiBaseurl: string;
  krc721ApiBaseurl: string;
  krc721CacheStreamUrl: string;
  knsApiBaseurl: string;
  kaspaExplorerBaseurl: string;
  kaspaNetwork: string;
  logosUrl: string;
  allowedDomains: string[];
  isL2Enabled: boolean;
  l2Configs: L2ConfigInterface[];
}
