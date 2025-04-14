export interface TokenHistoryResponse {
  message: string;
  result: {
    owner: string;
    opScoreMod: string;
    txIdRev: string;
  }[];
  next: string;
}

