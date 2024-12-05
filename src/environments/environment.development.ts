import { KASPA_NETWORKS } from '../app/config/consts';
import { Environment } from './environment.interface';

export const environment: Environment = {
  isProduction: false,
  backendApiBaseurl: 'https://dev-api.kaspiano.com',
  kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
  kaspaNetwork: KASPA_NETWORKS.TESTNET10,
};
