/**
 * Parameters for the KNS API call to get the assets of a wallet.
 */
export interface KnsWalletAssetsParams {
    /**
     * The wallet address to show the assets of.
     */
    owner: string;
    /**
     * The asset to filter the results by.
     * If not provided, all assets will be returned.
     */
    asset?: string;
    /**
     * The status of the assets to filter the results by.
     * default - not listed, listed - listed for sale
     * If not provided, all statuses will be returned.
     */
    status?: KnsWalletAssetStatus;
    /**
     * The page number of the results.
     * If not provided, the first page will be returned.
     */
    page?: number;
    /**
     * The number of items per page.
     * Default value is 20, max is 100.
     * If not provided, the default page size will be used.
     */
    pageSize?: number;
}

export enum KnsWalletAssetStatus {
    DEFAULT = 'default',
    LISTED = 'listed',
}