export interface SavedWalletData {
    id: number;
    name: string;
    privateKey: string;
    mnemonic?: string;
    derivedPath?: string;
}