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
