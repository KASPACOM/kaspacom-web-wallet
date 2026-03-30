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
  wrappedToken?: {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  routerAddress?: string;
  factoryAddress?: string;
  routerPermitFeeAddress?: string;
  pairCodeHash?: string;
  badckendApiUrl?: string;
  defiApiNetworkName?: string;
}

export interface L2ConfigInterface {
  sdkName: string,
  icon: string,
  l1TransactionPrefix?: string;
  /** Optional custom chain config — used when sdkName is not present in the swap-sdk NETWORKS */
  customChainConfig?: L2CustomChainConfig;
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
  allowedDomains: string[];
  isL2Enabled: boolean;
  l2Configs: L2ConfigInterface[],
  logosUrl?: string;
}