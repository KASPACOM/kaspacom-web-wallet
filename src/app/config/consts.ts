export const LOCAL_STORAGE_KEYS = {
    ENCRYPTED_MESSAGE: 'encryptedMessage',
    WALLETS_DATA: 'userData',
    CURRENT_SELECTED_WALLET: 'currentSelectedWallet',
}

export const KASPA_NETWORKS = {
    MAINNET: 'mainnet',
    TESTNET10: 'testnet-10'
}

export const ENCRYPTED_MESSAGE_VALUE = 'Kaspa.com!';
export const DEFAULT_DERIVED_PATH = "m/44'/111111'/0'/0/0";

export const ERROR_CODES = {
    WALLET_ACTION: {
        WALLET_NOT_SELECTED: 1001,
        INVALID_ACTION_TYPE: 1002,
        INVALID_AMOUNT: 1003,
        INVALID_ADDRESS: 1004,
        INSUFFICIENT_BALANCE: 1005,
        USER_REJECTED: 1006,

    }
}