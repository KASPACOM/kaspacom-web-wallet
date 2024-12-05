export type TransferableAsset = { ticker: string; name?: string; type: AssetType, availableAmount: bigint; };
export enum AssetType {
    KRC20 = 'krc-20',
    KAS = 'kas',
}