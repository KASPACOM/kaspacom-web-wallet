export interface IToken {
  name: string;
  symbol: string;
  address: string;
  balance: number;
  usdPrice: number;
  decimals?: number; // Number of decimal places for the token
}
