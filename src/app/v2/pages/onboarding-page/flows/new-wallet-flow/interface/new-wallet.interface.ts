export interface INewWallet {
  password: string;
  confirmPassword: string;
  seedPhraseWordCount: number;
  seedPhrase: string;
  seedPhraseSaved: boolean;
  walletAddress: string;
}
