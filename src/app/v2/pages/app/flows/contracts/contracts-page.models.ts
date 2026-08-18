import { ContractRegistryEntry } from '../../../../../services/covenant/contract-registry.service';
import {
  IndexerCovenantAction,
  IndexerCovenantArg,
  IndexerCovenantDetails,
  IndexerCovenantResponse,
  IndexerCovenantUtxo,
} from '../../../../../services/covenant/covenant-indexer.service';
import { ContractTemplate } from '../../../../services/covenant/contract-templates';

export type TabName =
  | 'deploy'
  | 'my-contracts'
  | 'lookup-import'
  | 'interact'
  // Confirmed unreachable: activeTab is never set to 'templates' by any nav
  // button or .set() call. Left in the union rather than removed pending a
  // separate decision on the dead 'templates' tab markup this once paired
  // with (already gone from the current shell template).
  | 'templates'
  | 'detail';
export type ContractDetailTab = 'details' | 'action';
export type ContractsTransientState = {
  activeTab?: TabName;
  detailPanelTab?: ContractDetailTab;
  actionPageView?: 'list' | 'form';
  selectedFunction?: string;
  interactContractJson?: string;
  interactOutpointTxid?: string;
  interactOutpointVout?: string;
  interactInputAmount?: string;
  interactOutputAddress?: string;
  interactOutputAmount?: string;
  topUpAmount?: string;
  partialSpendJson?: string;
  interactResult?: { txid: string; functionName: string };
  hideActionsAfterCompletion?: boolean;
  landOnContractId?: string;
};

export type IndexerImportPreview = {
  action: IndexerCovenantAction;
  activeAction: IndexerCovenantAction;
  activeUtxo: IndexerCovenantUtxo;
  args: IndexerCovenantArg[];
  compiledJson: string;
  contractAddress: string;
  covenantId: string;
  deployTxid: string;
  error?: string;
  fieldValues: Record<string, string>;
  outpoint: { txid: string; vout: number };
  template: ContractTemplate;
  templateName: string;
  amountSompi: string;
  deployedAt: number;
  isLatestContinuation: boolean;
};

export type ContractDashboardSource = 'indexer' | 'local' | 'both';
export type ContractDashboardFilter =
  'all' | 'deadman' | 'timelock' | 'multisig' | 'escrow' | 'selfcustody';
// Status dimension, composed on top of the template-type filter above.
export type ContractStatusFilter = 'all' | 'active' | 'history';
export type ContractParticipant = {
  label: string;
  value: string;
  matchValues?: string[];
  hidden?: boolean;
};

export type ContractDashboardEntry = {
  id: string;
  source: ContractDashboardSource;
  contractName: string;
  displayName: string;
  contractTypeLabel: string;
  aliasName?: string;
  aliases?: Record<string, string>;
  status: 'active' | 'spent' | 'unknown' | 'tracking-incomplete';
  amountSompi: string;
  currentAddress?: string;
  covenantId?: string;
  scriptHash?: string;
  deployTxid?: string;
  latestTxid?: string;
  latestAction?: string;
  /** blockTimeMs or local timestamp for latestTxid/latestAction recency comparisons. */
  latestActionAtMs?: number;
  deadlineMs?: number;
  participants: ContractParticipant[];
  nextActionLabel: string;
  actionHint: string;
  registryEntry?: ContractRegistryEntry;
  indexerSummary?: IndexerCovenantDetails;
};

export type ContractDetailState = {
  entry: ContractDashboardEntry;
  response?: IndexerCovenantResponse;
  actions: IndexerCovenantAction[];
  utxos: IndexerCovenantUtxo[];
};

export type ContractDetailParameter = {
  label: string;
  value: string;
  type?: string;
};

export type AvailableAction = {
  fnName: string;
  label: string;
  description: string;
  iconClass: string;
  enabled: boolean;
  disabledReason?: string;
};

export type DeployIndexerState = {
  txid: string;
  status: 'checking' | 'indexed' | 'not-indexed' | 'unavailable';
  message: string;
  covenantId?: string;
};

export type ActionIndexerState = {
  txid: string;
  status: 'checking' | 'indexed' | 'not-indexed' | 'unavailable';
  message: string;
};

export const SELF_CUSTODY_WHITELIST_CAPACITY = 10;
