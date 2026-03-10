export interface L2ConfigInterface {
  sdkName: string,
  icon: string,
  l1TransactionPrefix?: string;
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
}