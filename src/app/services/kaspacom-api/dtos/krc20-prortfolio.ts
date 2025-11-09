export type Krc20PortfolioResponse = Krc20PortfolioItem[];

export interface Krc20PortfolioItem {
  ticker: string;
  state: string;
  logo: string;
  price?: number;
}
