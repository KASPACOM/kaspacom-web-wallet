export interface VerifiedTokenExternalUsdPriceInterface {
  provider: 'coingecko';
  coinGeckoId: string;
}

export interface VerifiedTokenInterface {
  symbol: string;
  address: string;
  decimals?: number;
  externalUsdPrice?: VerifiedTokenExternalUsdPriceInterface;
}

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
  swapContracts?: {
    factoryAddress: string;
    routerAddress: string;
    proxyAddress?: string;
  };
}

export interface L2ConfigInterface {
  /** SDK network key — used only by the swap flow to initialize the swap controller */
  sdkName: string;
  /** Relative path to the chain's SVG icon (e.g. 'images/chains/kasplex.svg') */
  icon: string;
  /** One-word display name shown in the header (e.g. 'Kasplex', 'Galleon') */
  shortName: string;
  l1TransactionPrefix?: string;
  verifiedTokens?: VerifiedTokenInterface[];
  /** Chain config for wallet operations (RPC, chain ID, explorer, native token). Required for all L2 chains. */
  customChainConfig: L2CustomChainConfig;
}

export interface L1ConfigInterface {
  shortName: string;
  icon: string;
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
  l1Config: L1ConfigInterface;
  isL2Enabled: boolean;
  l2Configs: L2ConfigInterface[];
}
