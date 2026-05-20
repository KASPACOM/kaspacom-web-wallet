import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';
import { PRODUCTION_L1_NETWORKS } from './l1-network-configurations';

export const environment: Environment = {
  isProduction: true,
  consentScriptUrl: 'https://kaspa.com/js/modules/kaspa-consent.min.js',
  consentCssUrl: 'https://kaspa.com/css/consent.min.css',
  segmentKey: 'VjcBOF7puALWzPyE19iNkCLseTTDfVga',
  clarityKey: 'v3s9mm1mn8',
  addressableKey: '2e716db8140e460fa988107810e59824',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  logosUrl: 'https://erc20-logo.s3.us-east-1.amazonaws.com/',
  allowedDomains: ['wallet.kaspa.com'],
  l1Config: {
    shortName: 'Kaspa L1',
    icon: 'images/tokens-logos/KAS.png',
    networks: PRODUCTION_L1_NETWORKS,
  },
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
      sdkName: 'igra',
      icon: 'images/chains/igra.svg',
      shortName: 'IGRA',
      l1TransactionPrefix: 'igra',
      verifiedTokens: [
        {
          address: '0xA5b8BF902b2844dA17d4506cc827F7F1681735E7',
          symbol: 'USDC',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'usd-coin' },
        },
        {
          address: '0xF2B48b6e560af8834622203a8EEff6960d6172De',
          symbol: 'cbBTC',
          decimals: 8,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'coinbase-wrapped-btc' },
        },
        {
          address: '0xC3f8B34587EB403FC30a161d6A35cB724A3b273E',
          symbol: 'wstETH',
          decimals: 18,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'wrapped-steth' },
        },
        {
          address: '0x69790024D44504F05973E127197E6df17e283859',
          symbol: 'WETH',
          decimals: 18,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'weth' },
        },
        {
          address: '0x5a19b7B45C3DF3D436f1010Fb5B95755800F22f3',
          symbol: 'USDS',
          decimals: 18,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'usds' },
        },
        {
          address: '0x46346F49b4fe8c640c5FCdbed2d6741056FEB959',
          symbol: 'USDT',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'tether' },
        },
        {
          address: '0xB9EC76392f7d48F6B266431951cb7c645bd711e2',
          symbol: 'SOL',
          decimals: 9,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'solana' },
        },
      ],
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
        wrappedTokenAddress: '0x17Ec7E1768c813E2a3a9b0f94A35605CA520C242',
        swapContracts: {
          factoryAddress: '0x21350BcDa9E81731CF4cDE3DbC457e3de2739c01',
          routerAddress: '0x771dfB21e1CD8EA3e8B68cB2469eDaF9548c2523',
          proxyAddress: '0xDD1aBB133D027f4F67571b5bEEDC9cd9a93C13Ca',
        },
      },
    },
  ],
};
