export interface Environment {
  isProduction: boolean;
  backendApiBaseurl: string;
  kasplexApiBaseurl: string;
  kaspaApiBaseurl: string;
  kaspaNetwork: string;
  allowedDomains: string[];
  allowedIframeDomains: string[],
  etherRpcUrl: string,
  etherChainId: number,
}