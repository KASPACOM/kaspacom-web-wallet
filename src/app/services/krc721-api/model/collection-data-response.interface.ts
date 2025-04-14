export interface CollectionDataResult {
    deployer: string;
    royaltyTo: string;
    buri: string;
    max: string;
    royaltyFee: string;
    daaMintStart: string;
    premint: string;
    tick: string;
    txIdRev: string;
    mtsAdd: string;
    minted: string;
    opScoreMod: string;
    state: string;
    mtsMod: string;
    opScoreAdd: string;
}

export interface CollectionDataResponse {
    message: string;
    result: CollectionDataResult;
}

