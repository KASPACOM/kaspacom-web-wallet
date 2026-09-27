import type { TransferPlanned } from '@dotk/sdk-tx';

export interface DotkNameAsset {
  /** Bare on-chain name, without the presentation suffix. */
  name: string;
  /** Canonical display name, including .k. */
  display: string;
  deedAddress: string;
  proven: boolean | null;
  primary: boolean;
  hasRecordsCard: boolean;
  recordKeys: string[];
  subnames: DotkSubname[];
}

export interface DotkNameRecord {
  key: string;
  value: string;
}

export interface DotkSubname {
  label: string;
  display: string;
  address: string | null;
  fault?: string;
}

export interface DotkNameDetail {
  name: string;
  display: string;
  address: string | null;
  ownerCovenantId?: string;
  ownerType: number;
  owner: string;
  deedAddress: string;
  proven: boolean | null;
  records: DotkNameRecord[];
  subnames: DotkSubname[];
}

export interface DotkResolution {
  address: string | null;
  display: string;
  error?: string;
}

/**
 * A fully priced transfer plan kept on the local wallet action until the user
 * approves it. The SDK does not ask the wallet to sign while planning.
 */
export interface DotkTransferActionData {
  name: string;
  displayName: string;
  recipient: string;
  feeSompi: bigint;
  network: string;
  recordsCardRetired: boolean;
  recordKeysDropped: string[];
  plan: TransferPlanned;
}
