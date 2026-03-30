import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  consentScriptUrl: 'https://dev.kaspa.com/js/modules/kaspa-consent.min.js',
  consentCssUrl: 'https://dev.kaspa.com/css/consent.min.css',
  kaspaComApiBaseurl: 'https://dev-api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://dev-api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  krc721ApiBaseurl: 'https://testnet-10.krc721.stream/api/v1/krc721/testnet-10',
  krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/testnet-10',
  knsApiBaseurl: 'https://api.knsdomains.org/tn10',
  kaspaExplorerBaseurl: 'https://explorer-tn10.kaspa.org',
  logosUrl: 'https://erc20-logo-dev.s3.eu-central-1.amazonaws.com/',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
  allowedDomains: [
    'localhost',
    '127.0.0.1',
    'dev-wallet.kaspa.com',
    'local.kaspa.com',
  ],
  isL2Enabled: true,
  l2Configs: [
    {
      sdkName: 'kasplex-testnet',
      icon: '💎',
      l1TransactionPrefix: 'kasplex',
      customChainConfig: {
        chainId: 167012,
        name: 'Kasplex Testnet',
        rpcUrl: 'https://rpc.kasplextest.xyz',
        blockExplorerUrl: 'https://explorer.testnet.kasplextest.xyz',
        nativeToken: {
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'Kasplex Kaspa',
          symbol: 'KAS',
        },
        defiApiNetworkName: 'kasplex',
      },
    },
    {
      sdkName: 'igra-testnet',
      icon: '🔷',
      l1TransactionPrefix: 'igra',
      customChainConfig: {
        chainId: 38836,
        name: 'IGRA Testnet (Galleon)',
        rpcUrl: 'https://galleon-testnet.igralabs.com:8545',
        blockExplorerUrl: 'https://explorer.galleon-testnet.igralabs.com',
        nativeToken: {
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'Igra Kaspa',
          symbol: 'IKAS',
        },
        defiApiNetworkName: 'igra',
      },
    },
  ],
  segmentKey: 'a2Kx82H0p5djHvyPAFYwOHeqqIsFbmqd',
};
