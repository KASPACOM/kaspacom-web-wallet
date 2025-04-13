import { KnsWalletAssetStatus } from "./kns-wallet-assets-params.interface";

export interface KnsWalletAsset {
  id: string;
  assetId: string;
  mimeType: string;
  asset: string;
  owner: string;
  creationBlockTime: string;
  isDomain: boolean;
  isVerifiedDomain: boolean;
  status: KnsWalletAssetStatus;
  transactionId: string;
  listed?: {
    transactionId: string;
    blockTime: string;
  };
}

export interface KnsWalletAssetsResponse {
  success: boolean;
  data: {
    assets: KnsWalletAsset[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

export interface KnsAssetDetailResponse {
  success: boolean,
  data: KnsWalletAsset,
}

