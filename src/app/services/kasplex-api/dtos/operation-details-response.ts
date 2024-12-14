import { KRC20OperationType } from "../../../types/kaspa-network/krc20-operations-data.interface";

export enum AcceptedStatus {
  Accepted = "1",
  Rejected = "-1",
}

export interface OperationDetails {
  p: string;
  op: KRC20OperationType;
  tick: string;
  max?: string;
  lim?: string;
  pre?: string;
  dec?: string;
  amt?: string;
  utxo?: string;
  from: string;
  to?: string;
  opScore: string;
  hashRev: string;
  feeRev: string;
  txAccept: AcceptedStatus;
  opAccept: AcceptedStatus;
  opError: string;
  checkpoint: string;
  mtsAdd: string;
  mtsMod: string;
}

export interface OperationDetailsResponse {
  message: string;
  result: OperationDetails[];
}
