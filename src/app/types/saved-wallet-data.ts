export interface SavedWalletData {
    id: number;
    name: string;
    privateKey?: string;
    mnemonic?: string;
    password?: string;
    derivedPath?: string;
    accounts?: SavedWalletAccount[],
    version?: number;
}

export interface SavedWalletAccount {
    name: string;
    derivedPath: string;
}