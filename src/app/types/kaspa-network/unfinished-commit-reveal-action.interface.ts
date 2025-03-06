import { CommitRevealAction } from "../wallet-action";

export interface UnfinishedCommitRevealAction {
  operationData: CommitRevealAction;
  walletAddress: string;
  createdAtTimestamp: number;
  commitTransactionId?: string;
}
