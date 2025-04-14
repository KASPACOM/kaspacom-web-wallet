export interface TokenOwner {
    tick: string;
    tokenId: string;
    owner: string;
    opScoreMod: string;
}

export interface TokenOwnersResponse {
    message: string;
    result: TokenOwner[];
    next: number;
}