import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  backendApiBaseurl: 'https://dev-api.kaspiano.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  krc721ApiBaseurl: 'https://testnet-10.krc721.stream/api/v1/krc721/testnet-10',
  knsApiBaseurl: 'https://api.knsdomains.org/tn10',
  kaspaExplorerBaseurl: 'https://explorer-tn10.kaspa.org',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
  allowedDomains: ['localhost', 'dev-wallet.kaspa.com', 'local.kaspa.com'],
  isL2Enabled: true,
  l2Configs: {
    kasplex: {
      l1PayloadPrefix: 'kasplex',
      chainId: 167012,
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
