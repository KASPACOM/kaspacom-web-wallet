export interface KnsDomainOwnerResponse {
  success: boolean;
  data: {
    id: string;
    assetId: string;
    asset: string;
    owner: string;
  };
}