import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: true,
  consentScriptUrl: 'https://dev.kaspa.com/js/modules/kaspa-consent.min.js',
  consentCssUrl: 'https://dev.kaspa.com/css/consent.min.css',
  kaspaComApiBaseurl: 'https://api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  krc721ApiBaseurl: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
  krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/mainnet',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
  kaspaExplorerBaseurl: 'https://explorer.kaspa.org',
  logosUrl: 'https://erc20-logo-dev.s3.eu-central-1.amazonaws.com/',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  allowedDomains: ['wallet.kaspa.com'],
  isL2Enabled: true,
  l2Configs: [
    {
      sdkName: 'kasplex',
      icon: 'images/chains/kasplex.svg',
      shortName: 'Kasplex',
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
      icon: 'images/chains/igra.svg',
      shortName: 'IGRA',
      l1TransactionPrefix: 'igra',
      customChainConfig: {
        chainId: 38833,
        name: 'IGRA Mainnet',
        rpcUrl: 'https://rpc.igralabs.com:8545',
        blockExplorerUrl: 'https://explorer.igralabs.com',
        nativeToken: {
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'IgraKaspa',
          symbol: 'IKAS',
        },
        defiApiNetworkName: 'igra',
      },
    },
  ],
  segmentKey: 'VjcBOF7puALWzPyE19iNkCLseTTDfVga',
};
