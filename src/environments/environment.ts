import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: true,
  backendApiBaseurl: 'https://api.kaspiano.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  krc721ApiBaseurl: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  allowedDomains: ['wallet.kaspa.com'],
  isL2Enabled: false,
  l2Configs: {
    kasplex: {
      l1PayloadPrefix: 'kasplex',
      chainId: 12211,
      name: "Kasplex",
      network: "kasplex",
      nativeCurrency: {
        name: "Kasplex",
        symbol: "KAS",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://rpc.kasplex.xyz"],
        },
        public: {
          http: ["https://rpc.kasplex.xyz"],
        },
      },
    },
  },
};

