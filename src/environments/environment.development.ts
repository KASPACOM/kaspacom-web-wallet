import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  backendApiBaseurl: 'https://dev-api.kaspiano.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  knsApiBaseurl: 'https://api.knsdomains.org/tn10/api/v1',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
  allowedDomains: ['localhost', 'dev-wallet.kaspa.com', 'local.kaspa.com'],
  allowedIframeDomains: ['localhost', 'dev.kaspa.com', 'local.kaspa.com'],
  kasplexL2Config: {
    rpcUrl: 'https://rpc.kasplextest.xyz',
    chainId: 12211,
    name: 'Kasplex Testnet',
  },
};
