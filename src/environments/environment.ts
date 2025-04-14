import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: true,
  backendApiBaseurl: 'https://api.kaspiano.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet/api/v1',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  allowedDomains: ['wallet.kaspa.com'],
  allowedIframeDomains: ['kaspa.com', 'www.kaspa.com'],
  kasplexL2Config: {
    rpcUrl: 'https://rpc.kasplex.xyz',
    chainId: 12211,
    name: 'Kasplex L2',
  },
  krc721Api: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
  krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/mainnet',
};

