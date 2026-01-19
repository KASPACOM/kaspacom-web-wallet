import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  kaspaComApiBaseurl: 'https://api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  krc721ApiBaseurl: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
  krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/mainnet',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
  kaspaExplorerBaseurl: 'https://explorer.kaspa.org',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  allowedDomains: ['stage-wallet.kaspa.com'],
  isL2Enabled: true,
  l2Configs: [
    {
      sdkName: 'kasplex',
      icon: '💎',
      l1TransactionPrefix: 'kaspelx',
      kaspaComApiNetworkName: 'kasplex',
    },
  ],
  segmentKey: 'a2Kx82H0p5djHvyPAFYwOHeqqIsFbmqd',
};
