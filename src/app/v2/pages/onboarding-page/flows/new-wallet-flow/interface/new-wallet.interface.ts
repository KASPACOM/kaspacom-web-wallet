export interface INewWallet {
  password: string;
  confirmPassword: string;
  seedPhraseWordCount: number;
  seedPhrase: string;
  // Added optional seed phrase passphrase, not the same as the container password
  seedPassphrase: string;
  seedPhraseSaved: boolean;
  walletAddress: string;
}
