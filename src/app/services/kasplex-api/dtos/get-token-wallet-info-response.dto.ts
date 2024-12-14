export interface GetTokenWalletInfoDto {
  tick: string;
  balance: string;
  locked: string;
  dec: string;
  opScoreMod: string;
}

export type GetTokenWalletInfoResponse = {
  message: string;
  result: GetTokenWalletInfoDto[];
};
