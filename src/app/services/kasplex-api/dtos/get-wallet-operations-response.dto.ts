import { OperationDetails } from "./operation-details-response";

export interface GetWalletOperationsResponse {
  message: string;
  prev: string;
  next: string;
  result: OperationDetails[];
}
