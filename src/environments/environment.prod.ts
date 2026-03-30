import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: true,
  consentScriptUrl: 'https://kaspa.com/js/modules/kaspa-consent.min.js',
  consentCssUrl: 'https://kaspa.com/css/consent.min.css',
  segmentKey: 'VjcBOF7puALWzPyE19iNkCLseTTDfVga',
  clarityKey: 'v3s9mm1mn8',
  addressableKey: '2e716db8140e460fa988107810e59824',
  kaspaComApiBaseurl: 'https://api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  krc721ApiBaseurl: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
  krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/mainnet',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
  kaspaExplorerBaseurl: 'https://explorer.kaspa.org',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  logosUrl: 'https://erc20-logo.s3.us-east-1.amazonaws.com/',
  allowedDomains: ['wallet.kaspa.com'],
  isL2Enabled: true,
  l2Configs: [
    {
      sdkName: 'kasplex',
      icon: '💎',
      l1TransactionPrefix: 'kasplex',
      customChainConfig: {
        chainId: 202555,
        name: 'Kasplex',
        rpcUrl: 'https://evmrpc.kasplex.org',
        blockExplorerUrl: 'https://explorer.kasplex.org',
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
      sdkName: 'igra-mainnet',
      icon: '🔷',
      l1TransactionPrefix: 'igra',
      customChainConfig: {
        chainId: 38833,
        name: 'IGRA Mainnet',
        rpcUrl: 'https://rpc.igralabs.com:8545',
        blockExplorerUrl: 'https://explorer.igralabs.com',
        nativeToken: {
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'Kaspa',
          symbol: 'KAS',
        },
        defiApiNetworkName: 'igra',
      },
    },
  ],
};
