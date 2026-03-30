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
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  allowedDomains: ['wallet.kaspa.com'],
  isL2Enabled: true,
  l2Configs: [
    {
      sdkName: 'kasplex',
      icon: '💎',
      l1TransactionPrefix: 'kasplex',
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
        wrappedToken: {
          address: '0x17Ec7E1768c813E2a3a9b0f94A35605CA520C242',
          decimals: 18,
          name: 'Wrapped KAS',
          symbol: 'WKAS',
        },
        routerAddress: '0x771dfB21e1CD8EA3e8B68cB2469eDaF9548c2523',
        factoryAddress: '0x21350BcDa9E81731CF4cDE3DbC457e3de2739c01',
        routerPermitFeeAddress: '0xDD1aBB133D027f4F67571b5bEEDC9cd9a93C13Ca',
        pairCodeHash: '0xad75e7559797de892c0b38a8d0c5dd09cd6c987192b302fbde71ac2f810a9471',
        badckendApiUrl: 'https://api-defi.kaspa.com',
        defiApiNetworkName: 'igra',
      },
    },
  ],
  segmentKey: 'VjcBOF7puALWzPyE19iNkCLseTTDfVga',
};