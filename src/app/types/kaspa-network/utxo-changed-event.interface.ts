import { UtxoEntryReference } from '../../../../public/kaspa/kaspa';

export interface UtxoChangedEvent {
  type: 'utxos-changed';
  data: {
    added: UtxoEntryReference[];
    removed: UtxoEntryReference[];
  };
}
