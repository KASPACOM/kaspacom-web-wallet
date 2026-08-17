export type ContractStatus = 'active' | 'spent' | 'unknown';

export interface SavedContractRegistryEntry {
  id: string; // uuid
  contractName: string;
  compiledJson: string; // full JSON for re-interaction
  deployTxid: string;
  contractAddress: string;
  outpoint: { txid: string; vout: number };
  amountSompi: string; // bigint as string
  deployedBy: { address: string; pubkey: string; accountName: string };
  deployedAt: number; // timestamp
  network: string;
  status?: ContractStatus; // on-chain status
  lastChecked?: number; // timestamp of last status check
  spendTxid?: string; // TX that spent this contract
  /** Function name of the most recent action this wallet executed locally (e.g. 'keepAlive', 'claim'), until the indexer catches up. */
  lastActionType?: string;
  /** TX that performed `lastActionType`. */
  lastActionTxid?: string;
  /** When `lastActionType` was executed — set only alongside it, unlike `lastChecked` which unrelated status-refresh polling also bumps. */
  lastActionAt?: number;
  // Parsed access info
  accessRoles: Array<{
    functionName: string;
    params: Array<{ name: string; type: string }>;
    description: string; // human readable like "Owner can spend"
  }>;
  covenantId?: string;
  /** Wallet+account IDs that should see this contract, keyed by AppWallet.getIdWithAccount(). */
  wallets?: Record<string, boolean>;
  /** Per wallet+account nickname map, keyed by AppWallet.getIdWithAccount(). */
  aliases?: Record<string, string>;
  /** ID of the registry entry that this contract continues (keepAlive chain) */
  predecessorId?: string;
}

export type ContractRegistryEntry = SavedContractRegistryEntry;
