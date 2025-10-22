export interface L2ConfigInterface {
  sdkName: string,
  icon: string,
  l1TransactionPrefix?: string;
  erc20GraphUrl?: string;
}

export interface Environment {
  isProduction: boolean;
  backendApiBaseurl: string;
  kasplexApiBaseurl: string;
  kaspaApiBaseurl: string;
  krc721ApiBaseurl: string;
  knsApiBaseurl: string;
  kaspaExplorerBaseurl: string;
  kaspaNetwork: string;
  allowedDomains: string[];
  isL2Enabled: boolean;
  l2Configs: L2ConfigInterface[],
}