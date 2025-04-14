export interface StatusResult {
  version: string;
  network: string;
  isNodeConnected: boolean;
  isNodeSynced: boolean;
  isIndexerSynced: boolean;
  lastKnownBlockHash: string;
  daaScore: number; // uint64
  powFeesTotal: number; // uint64
  royaltyFeesTotal: number; // uint64
  tokenDeploymentsTotal: number; // uint64
  tokenMintsTotal: number; // uint64
  tokenTransfersTotal: number; // uint64
}

export interface StatusResponse {
  message: string;
  result: StatusResult;
}


