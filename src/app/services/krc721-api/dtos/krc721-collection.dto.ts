export interface Krc721Collection {
  deployer: string;
  buri?: string;
  max: string;
  daaMintStart: string;
  premint: string;
  tick: string;
  txIdRev: string;
  mtsAdd: string;
  minted: string;
  opScoreMod: string;
  state: 'deployed';
  mtsMod: string;
  opScoreAdd: string;
  royaltyFee?: string;
  royaltyTo?: string;
  mintFundsRecipient?: string;
  mintPrice?: string;
  totalSupply?: string;
}

export interface Krc721CollectionResponse {
  message: string;
  result: Krc721Collection;
}

export interface Krc721CollectionsResponse {
  message: string;
  result: Krc721Collection[];
  next?: number;
  prev?: number;
}