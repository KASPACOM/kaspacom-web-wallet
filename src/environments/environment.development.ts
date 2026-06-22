import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';
import { DEVELOPMENT_L1_NETWORKS } from './l1-network-configurations';

export const environment: Environment = {
  isProduction: false,
  consentScriptUrl: 'https://dev.kaspa.com/js/modules/kaspa-consent.min.js',
  consentCssUrl: 'https://dev.kaspa.com/css/consent.min.css',
  logosUrl: 'https://erc20-logo-dev.s3.eu-central-1.amazonaws.com/',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
  allowedDomains: [
    'localhost',
    '127.0.0.1',
    'dev-wallet.kaspa.com',
    'local.kaspa.com',
  ],
  l1Config: {
    shortName: 'Kaspa L1',
    icon: 'images/tokens-logos/KAS.png',
    networks: DEVELOPMENT_L1_NETWORKS,
  },
  l2Configs: [
    {
      sdkName: 'kasplex-testnet',
      icon: 'images/chains/kasplex.svg',
      shortName: 'Kasplex',
      l1TransactionPrefix: 'kasplex',
      verifiedTokens: [
        {
          address: '0xf40178040278E16c8813dB20a84119A605812FB3',
          symbol: 'WKAS',
          decimals: 18,
        },
        {
          address: '0x508B83AB67fEDcd1e8b6F8AE88F5Eb0B1670eFb6',
          symbol: 'WBTC',
          decimals: 8,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'wrapped-bitcoin' },
        },
        {
          address: '0x54319ceE10d537Dec6aa812d6f22eC3F31AC7ca6',
          symbol: 'WETH',
          decimals: 18,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'weth' },
        },
        {
          address: '0x9E7edE66d39d9b69d817b7368CD9d66a7D6Dc468',
          symbol: 'DAI',
          decimals: 18,
        },
        {
          address: '0xFC84a4b04E0074D08c4242A291bfC73840E5Ad14',
          symbol: 'USDC',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'usd-coin' },
        },
        {
          address: '0xDaf8B68Cdf320727af105bCa68e174b5EDB3433E',
          symbol: 'USDT',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'tether' },
        },
      ],
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
        wrappedTokenAddress: '0xf40178040278E16c8813dB20a84119A605812FB3',
      },
    },
    {
      sdkName: 'igra-testnet',
      icon: 'images/chains/igra.svg',
      shortName: 'Igra',
      l1TransactionPrefix: 'igra',
      verifiedTokens: [
        {
          address: '0x394C68684F9AFCEb9b804531EF07a864E8081738',
          symbol: 'WKAS',
          decimals: 18,
        },
        {
          address: '0x2429526815517B971d45B0899C3D67990A68BcD7',
          symbol: 'WBTC',
          decimals: 8,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'wrapped-bitcoin' },
        },
        {
          address: '0x23A8E284A6193C1D6A51A7b34d047ae0b969D660',
          symbol: 'WETH',
          decimals: 18,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'weth' },
        },
        {
          address: '0x2c680F22600A632c9291c2f1E3b070ED79c1168e',
          symbol: 'DAI',
          decimals: 18,
        },
        {
          address: '0xfEE6ee271c2fD76EdAd5De7B8177C3935799111A',
          symbol: 'USDC',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'usd-coin' },
        },
        {
          address: '0xb522AC3161D67b6Ed2e311E0036A2F49F903bcc7',
          symbol: 'USDT',
          decimals: 6,
          externalUsdPrice: { provider: 'coingecko', coinGeckoId: 'tether' },
        },
      ],
      customChainConfig: {
        chainId: 38836,
        name: 'IGRA Testnet (Galleon)',
        rpcUrl: 'https://galleon-testnet.igralabs.com:8545',
        blockExplorerUrl: 'https://explorer.galleon-testnet.igralabs.com',
        nativeToken: {
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'KAS',
          symbol: 'IKAS',
        },
        defiApiNetworkName: 'igra',
        wrappedTokenAddress: '0x394C68684F9AFCEb9b804531EF07a864E8081738',
      },
    },
  ],
  segmentKey: 'a2Kx82H0p5djHvyPAFYwOHeqqIsFbmqd',
};
