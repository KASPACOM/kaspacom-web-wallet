import { UtxoContext, UtxoProcessor } from '../../../../public/kaspa/kaspa';

export interface UtxoContextProcessorInterface {
  processor: UtxoProcessor;
  context: UtxoContext;
}
