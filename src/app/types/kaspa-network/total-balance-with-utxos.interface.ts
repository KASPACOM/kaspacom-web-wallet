import { UtxoEntryReference } from "../../../../public/kaspa/kaspa";

export interface TotalBalanceWithUtxosInterface {
  totalBalance: bigint;
  utxoEntries: UtxoEntryReference[];
}
