import { KRC20OperationType } from "../../../types/kaspa-network/krc20-operations-data.interface";

export interface OperationDetails {
  p: string;
  op: KRC20OperationType;
  tick: string;
  amt: string;
  from: string;
  utxo: string;
  opScore: string;
  hashRev: string;
  feeRev: string;
  txAccept: string;
  opAccept: string;
  opError: string;
  checkpoint: string;
  mtsAdd: string;
  mtsMod: string;
}

export interface OperationDetailsResponse {
  message: string;
  result: OperationDetails[];
}
