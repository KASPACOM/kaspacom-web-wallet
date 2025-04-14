export interface OperationDetailsResponse {
  message: string;
  result: {
    p: 'krc-721';
    deployer: string;
    to: string;
    tick: string;
    txIdRev: string;
    mtsAdd: string;
    op: string;
    opData: {
      tokenId: string;
      royalty: {
        royaltyFee: string;
      };
    };
    opScore: string;
    feeRev: string;
  };
}


