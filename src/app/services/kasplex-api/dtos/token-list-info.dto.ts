export interface TokenInfo {
  tick: string;
  balance: string;
  locked: string;
  dec: string;
  opScoreMod: string;
}

export interface GetTokenListResponse {
  message?: string;
  prev: string | null;
  next: string | null;
  result: TokenInfo[];
}

export interface GetTokenListDto {
  tick: string;
  balance: number;
  locked: number;
  decimals: number;
  opScoreMod: string;
}


export enum TokenState {
  FINISHED = 'finished',
  DEPLOYED = 'deployed',
  UNUSED = 'unused',
  IGNORED = 'ignored',
  RESERVED = 'reserved',

}

export interface GetTokenInfoResponse {
  message?: string;
  result?: [{
    tick: string;
    max: string;
    lim: string;
    pre: string;
    to: string;
    dec: string;
    minted: string;
    opScoreAdd: string;
    opScoreMod: string;
    state: TokenState;
    hashRev: string;
    mtsAdd: string;
    holderTotal: string;
    transferTotal: string;
    mintTotal: string;
    holder?: {
      address: string;
      amount: string;
    }[];
  }];
}

