import { KRC20OperationDataInterface } from "./krc20-operations-data.interface";

export interface UnfinishedKrc20Action {
  operationData: KRC20OperationDataInterface;
  walletAddress: string;
  createdAtTimestamp: number;
}
