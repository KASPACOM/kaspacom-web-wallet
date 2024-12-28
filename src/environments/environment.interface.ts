export interface Environment {
  isProduction: boolean;
  backendApiBaseurl: string;
  kasplexApiBaseurl: string;
  kaspaApiBaseurl: string;
  kaspaNetwork: string;
  mongodbUri: string;
  walletAddress: string;
}
