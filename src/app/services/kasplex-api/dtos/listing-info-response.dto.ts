export interface ListingInfoResponse {
  message: string;
  prev: string;
  next: string;
  result: ListingInfoEntry[];
}

export interface ListingInfoEntry {
  tick: string;
  from: string;
  amount: string;
  uTxid: string;
  uAddr: string;
  uAmt: string;
  uScript: string;
  opScoreAdd: string;
}
