import { KASPA_NETWORKS } from '../app/config/consts';
import { L1NetworkConfigInterface } from './environment.interface';

export const KASPA_MAINNET_L1_NETWORK_CONFIG: L1NetworkConfigInterface = {
  network: KASPA_NETWORKS.MAINNET,
  shortName: 'Kaspa Mainnet',
  icon: 'images/tokens-logos/KAS.png',
  blocksPerSecond: 10,
  kaspaWrpcUrls: ['wss://mainnet-node.kaspa.com/kaspa/mainnet/wrpc/borsh'],
  kaspaComApiBaseurl: 'https://api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  krc721ApiBaseurl: 'https://krc721-indexer.kaspa.com/api/v1/krc721/mainnet',
  krc721CacheStreamUrl: 'https://krc721-cache.kaspa.com/krc721/mainnet',
  knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
  covenantIndexerApiBaseurl: 'https://indexer.kaspa.com',
  kaspaExplorerBaseurl: 'https://explorer.kaspa.org',
  covenantExplorerBaseurl: 'https://covenants.kaspa.com',
  l1AvatarCollection: 'YONATOSHI',
};

export const KASPA_TN10_L1_NETWORK_CONFIG: L1NetworkConfigInterface = {
  network: KASPA_NETWORKS.TESTNET10,
  shortName: 'Kaspa TN10',
  icon: 'images/tokens-logos/KAS.png',
  blocksPerSecond: 10,
  kaspaWrpcUrls: [
    'wss://tn10-node.kaspa.com/kaspa/testnet-10/wrpc/borsh',
    'wss://tn10-node.kaspa.com/testnet-10',
  ],
  kaspaComApiBaseurl: 'https://dev-api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://dev-api-defi.kaspa.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  krc721ApiBaseurl:
    'https://dev-krc721-indexer.kaspa.com/api/v1/krc721/testnet-10',
  krc721CacheStreamUrl: 'https://krc721-cache-dev.kaspa.com/krc721/testnet-10',
  knsApiBaseurl: 'https://api.knsdomains.org/tn10',
  covenantIndexerApiBaseurl: 'https://tn10-indexer.kaspa.com',
  kaspaExplorerBaseurl: 'https://explorer-tn10.kaspa.org',
  covenantExplorerBaseurl: 'https://tn10-covenants.kaspa.com',
  l1AvatarCollection: 'PEPINO',
};

export const KASPA_TN12_L1_NETWORK_CONFIG: L1NetworkConfigInterface = {
  network: KASPA_NETWORKS.TESTNET12,
  shortName: 'Kaspa TN12',
  icon: 'images/tokens-logos/KAS.png',
  blocksPerSecond: 10,
  kaspaComApiBaseurl: 'https://dev-api.kaspa.com',
  kaspaComDefiApiBaseurl: 'https://dev-api-defi.kaspa.com',
  kaspaApiBaseurl: 'https://api-tn12.kaspa.org',
  krc721ApiBaseurl:
    'https://dev-krc721-indexer.kaspa.com/api/v1/krc721/testnet-10',
  krc721CacheStreamUrl: 'https://krc721-cache-dev.kaspa.com/krc721/testnet-10',
  kaspaExplorerBaseurl: 'https://tn12.kaspa.stream',
  l1AvatarCollection: 'PEPINO',
};

export const PRODUCTION_L1_NETWORKS: L1NetworkConfigInterface[] = [
  KASPA_MAINNET_L1_NETWORK_CONFIG,
];

export const DEVELOPMENT_L1_NETWORKS: L1NetworkConfigInterface[] = [
  KASPA_TN10_L1_NETWORK_CONFIG,
  KASPA_TN12_L1_NETWORK_CONFIG,
  KASPA_MAINNET_L1_NETWORK_CONFIG,
];
