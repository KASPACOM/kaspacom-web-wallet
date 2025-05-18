import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  backendApiBaseurl: 'https://dev-api.kaspiano.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
  allowedDomains: ['localhost', 'dev-wallet.kaspa.com', 'local.kaspa.com'],
  allowedIframeDomains: ['localhost', 'dev.kaspa.com', 'dev2.kaspa.com', 'local.kaspa.com'],
  isL2Enabled: true,
  l2Configs: {
    kasplex: {
      l1PayloadPrefix: 'kasplex',
      chainId: 12211,
      name: "Kasplex Test",
      network: "kasplextest",
      nativeCurrency: {
        name: "Kasplex",
        symbol: "KAS",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://rpc.kasplextest.xyz"],
        },
        public: {
          http: ["https://rpc.kasplextest.xyz"],
        },
      },
    },
  }
};
