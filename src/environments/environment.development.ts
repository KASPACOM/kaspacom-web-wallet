import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  backendApiBaseurl: 'https://api.kaspiano.com',
  kasplexApiBaseurl: 'https://api.kasplex.org/v1',
  kaspaApiBaseurl: 'https://api.kaspa.org',
  kaspaNetwork: KASPA_NETWORKS.MAINNET,
  mongodbUri: 'mongodb+srv://server_prod:akds9duSXFCl0VEA@p2p-trade.ctytt.mongodb.net/prod',
  walletAddress: 'kaspa:qzagv3jy9eagjqf5jugdsmqqaey49lf80t672t27jyv85z3nhujkuxq5k8rag'
};
