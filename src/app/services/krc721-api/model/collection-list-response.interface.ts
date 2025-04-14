export interface CollectionDetails {
    deployer: string;
    buri: string;
    max: string;
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

export interface CollectionListResponse {
    message: string;
    result: CollectionDetails[];
    next: number;
}

