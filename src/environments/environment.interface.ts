export interface Environment {
  isProduction: boolean;
  backendApiBaseurl: string;
  kasplexApiBaseurl: string;
  kaspaApiBaseurl: string;
  kaspaNetwork: string;
  allowedDomains: string[];
  allowedIframeDomains: string[],
  kasplexL2Config: {
    rpcUrl: string,
    chainId: number,
    name: string,
  },
}