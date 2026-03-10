export interface Krc721PortfolioItem {
  ticker: string;
  tokenIds: string[];
}

export type Krc721PortfolioResponse = Krc721PortfolioItem[];

export interface Krc721PortfolioTokenDetail {
  _id: string;
  ticker: string;
  tokenId: number | string;
  traits: Record<string, any>;
  rarityRank?: number;
  legendary?: boolean;
  id?: string;
}

export interface Krc721PortfolioDetailItem {
  ticker: string;
  tokenIds: Krc721PortfolioTokenDetail[];
}

export type Krc721PortfolioDetailResponse = Krc721PortfolioDetailItem[];

