import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DropdownOption,
  KcButtonComponent,
  KcDropdownSelectComponent,
  KcIconComponent,
  KcInputComponent,
  KcNumberInputComponent,
  KcTooltipDirective,
} from '@kaspacom/ui-kit';
import { blake2b } from '@noble/hashes/blake2b';
import { WalletService } from '../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../services/wallet-action.service';
import { QrScannerService } from '../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../services/utils.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { RpcService } from '../../../../../services/kaspa-netwrok-services/rpc.service';
import {
  ContractRegistryService,
  ContractRegistryEntry,
  ContractStatus,
} from '../../../../../services/covenant/contract-registry.service';
import {
  CovenantIndexerService,
  IndexerCovenantAction,
  IndexerCovenantArg,
  IndexerCovenantDetails,
  IndexerCovenantResponse,
  IndexerCovenantUtxo,
} from '../../../../../services/covenant/covenant-indexer.service';
import {
  CompiledContract,
  CovenantOutpoint,
  PartiallySignedSpend,
  SpendOutput,
} from '../../../../../services/covenant/covenant-sdk/types';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import {
  CONTRACT_TEMPLATES,
  ContractTemplate,
  TemplateField,
} from '../../../../services/covenant/contract-templates';
import {
  CtorArg,
  TemplatePatcherService,
} from '../../../../services/covenant/template-patcher.service';
import { PublicKey } from '../../../../../../../public/kaspa/kaspa';
import { KaspaL1NetworkService } from '../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { WalletActionType } from '../../../../../types/wallet-action';
import {
  CovenantCompletePartialActionResult,
  CovenantDeployActionResult,
  CovenantSpendActionResult,
} from '../../../../../types/wallet-action-result';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { WideWorkspaceService } from '../../../../services/wide-workspace.service';
import { ApprovalFlowService } from '../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CovenantDateTimeInputComponent } from './covenant-date-time-input.component';
import { WalletProfileOrbComponent } from '../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';
import {
  ContractsSidebarComponent,
  ContractsSidebarItem,
} from './components/contracts-sidebar/contracts-sidebar.component';

type TabName =
  | 'deploy'
  | 'my-contracts'
  | 'lookup-import'
  | 'interact'
  | 'templates'
  | 'detail';
type ContractDetailTab = 'details' | 'action';
type CreateMode = 'template' | 'custom';
type ContractsTransientState = {
  activeTab?: TabName;
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
};

type IndexerImportPreview = {
  action: IndexerCovenantAction;
  activeAction: IndexerCovenantAction;
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

type ContractDashboardSource = 'indexer' | 'local' | 'both';
type ContractDashboardFilter =
  | 'all'
  | 'deadman'
  | 'timelock'
  | 'multisig'
  | 'escrow';
// Status dimension, composed on top of the template-type filter above.
type ContractStatusFilter = 'all' | 'active' | 'history';

type ContractDashboardEntry = {
  id: string;
  source: ContractDashboardSource;
  contractName: string;
  displayName: string;
  status: 'active' | 'spent' | 'unknown' | 'tracking-incomplete';
  amountSompi: string;
  currentAddress?: string;
  covenantId?: string;
  scriptHash?: string;
  deployTxid?: string;
  latestTxid?: string;
  latestAction?: string;
  deadlineMs?: number;
  participants: Array<{ label: string; value: string }>;
  nextActionLabel: string;
  actionHint: string;
  registryEntry?: ContractRegistryEntry;
  indexerSummary?: IndexerCovenantDetails;
};

type ContractDetailState = {
  entry: ContractDashboardEntry;
  response?: IndexerCovenantResponse;
  actions: IndexerCovenantAction[];
  utxos: IndexerCovenantUtxo[];
};

type ContractDetailParameter = {
  label: string;
  value: string;
  type?: string;
};

type AvailableAction = {
  fnName: string;
  label: string;
  description: string;
  iconClass: string;
  enabled: boolean;
  disabledReason?: string;
};

type DeployIndexerState = {
  txid: string;
  status: 'checking' | 'indexed' | 'not-indexed' | 'unavailable';
  message: string;
  covenantId?: string;
};

@Component({
  selector: 'app-contracts-page',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcDropdownSelectComponent,
    KcIconComponent,
    KcInputComponent,
    KcNumberInputComponent,
    KcTooltipDirective,
    CopyButtonComponent,
    AddressSmartInputComponent,
    CovenantDateTimeInputComponent,
    WalletProfileOrbComponent,
    ContractsSidebarComponent,
  ],
  templateUrl: './contracts-page.component.html',
  styleUrl: './contracts-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class ContractsPageComponent implements OnInit, OnDestroy {
  readonly MIN_DEPLOY_AMOUNT_KAS = 0.5;
  private readonly MIN_CONTINUATION_AMOUNT_SOMPI = 50_000_000n;

  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private qrScannerService = inject(QrScannerService);
  private utilsHelper = inject(UtilsHelper);
  private covenantService = inject(CovenantService);
  private covenantIndexerService = inject(CovenantIndexerService);
  private rpcService = inject(RpcService);
  private registryService = inject(ContractRegistryService);
  private templatePatcher = inject(TemplatePatcherService);
  private http = inject(HttpClient);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);
  private flowPagesService = inject(FlowPagesService);
  wideWorkspaceService = inject(WideWorkspaceService);
  private approvalFlowService = inject(ApprovalFlowService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private routeSubscription?: Subscription;

  // Current active tab
  activeTab = signal<TabName>('my-contracts');

  // Current wallet
  currentWallet = computed(() => this.walletService.getCurrentWallet());

  // Deployment always uses the currently selected wallet.
  selectedAccount = computed(() => this.currentWallet() || undefined);

  deployAvailableBalance = computed(() => {
    const currentWallet = this.currentWallet();
    if (!currentWallet) return 0;
    const mature =
      currentWallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;
    return Number(mature) / 1e8;
  });

  // Computed pubkey for selected account
  selectedPubkey = computed(() => {
    const wallet = this.selectedAccount();
    if (!wallet) return '';
    return wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString();
  });

  selectedPubkeyHash = computed(() => {
    const pubkey = this.selectedPubkey();
    return pubkey ? this.computeBlake2bHex(this.hex32ToBytes(pubkey)) : '';
  });

  // Deploy form - plain properties for ngModel
  deployContractJson = signal('');
  deployContractTouched = false;
  deployContractError = signal('');
  deployAmount = '';
  deployAmountTouched = false;
  deployAmountError = signal('');
  deployResult = signal<{
    address: string;
    txid: string;
    covenantId?: string;
  } | null>(null);
  deployIndexerState = signal<DeployIndexerState | null>(null);
  deployError = signal<string | null>(null);
  isDeploying = signal(false);

  // Computed parsed contract from deploy JSON
  parsedDeployContract = computed(() => {
    try {
      if (!this.deployContractJson()) return null;
      return this.covenantService.parseCompiledContract(
        this.deployContractJson(),
      );
    } catch {
      return null;
    }
  });

  // Computed constructor params for deploy contract
  deployConstructorParams = computed(() => {
    const contract = this.parsedDeployContract();
    return contract?.ast.params || [];
  });

  // Computed entrypoint functions for deploy contract
  deployEntrypointFunctions = computed(() => {
    const contract = this.parsedDeployContract();
    if (!contract) return [];
    return contract.ast.functions.filter((f) => f.entrypoint);
  });

  // Contract registry (my contracts tab)
  registryContracts = signal<ContractRegistryEntry[]>([]);
  dashboardContracts = signal<ContractDashboardEntry[]>([]);
  dashboardFilter = signal<ContractDashboardFilter>('all');
  statusFilter = signal<ContractStatusFilter>('all');
  dashboardSearch = signal('');
  // Applies the template-type filter, the active/history status filter, and
  // the search query together. Status: 'active' = anything not settled
  // (active / unknown / tracking-incomplete, so ambiguous contracts are never
  // hidden under Active); 'history' = spent/settled only. Search matches
  // name, address, and covenant ID so a pasted value finds the right card.
  filteredDashboardContracts = computed(() => {
    const key = this.dashboardFilter();
    const status = this.statusFilter();
    const search = this.dashboardSearch().trim().toLowerCase();
    let list = this.dashboardContracts();
    if (key !== 'all') {
      list = list.filter((contract) => this.getTemplateKey(contract) === key);
    }
    if (status === 'active') {
      list = list.filter((contract) => contract.status !== 'spent');
    } else if (status === 'history') {
      list = list.filter((contract) => contract.status === 'spent');
    }
    if (search) {
      list = list.filter((contract) =>
        [
          contract.displayName,
          contract.contractName,
          contract.currentAddress,
          contract.covenantId,
        ].some((value) => value?.toLowerCase().includes(search)),
      );
    }
    return list;
  });
  dashboardLoading = signal(false);
  dashboardError = signal<string | null>(null);
  selectedDetail = signal<ContractDetailState | null>(null);
  selectedDetailLoading = signal(false);
  selectedDetailError = signal<string | null>(null);
  detailPanelTab = signal<ContractDetailTab>('details');
  detailRouteId = signal<string | null>(null);
  detailRouteNotFound = signal(false);
  pendingUrlImport = signal<string | null>(null);
  private readonly supportedIndexerTemplates = [
    'DeadManSwitch',
    'TimeLockVault',
    'MultiSigVault',
    'EscrowWithArbiter',
  ];

  /**
   * Maps a contract to one of the four v1 template keys — drives card accent,
   * icon, role labels, and which action UI is shown. Presentation-only.
   * Reuses the canonical name already computed by normalizeContractName()
   * (indexer label + argument-name fallback, resolved upstream in #257 and
   * stored as contractName on every ContractDashboardEntry); unresolved
   * (custom / tracking-incomplete) → 'default' (neutral UI).
   */
  getTemplateKey(
    input: any,
  ): 'deadman' | 'timelock' | 'multisig' | 'escrow' | 'default' {
    // ContractTemplate.id on the Create / Templates tabs.
    switch (input?.id) {
      case 'dead-mans-switch':
        return 'deadman';
      case 'time-lock-vault':
        return 'timelock';
      case 'multi-sig-vault':
        return 'multisig';
      case 'escrow-with-arbiter':
        return 'escrow';
    }
    switch (
      this.normalizeContractName(input?.contractName ?? input?.name ?? '')
    ) {
      case 'DeadManSwitch':
        return 'deadman';
      case 'TimeLockVault':
        return 'timelock';
      case 'MultiSigVault':
        return 'multisig';
      case 'EscrowWithArbiter':
        return 'escrow';
      default:
        return 'default';
    }
  }

  contractTemplates = CONTRACT_TEMPLATES;
  createMode = signal<CreateMode>('template');
  activeTemplate = signal<ContractTemplate | null>(null);
  templateFormValues: { [paramName: string]: string } = {};
  templateFieldTouched: { [paramName: string]: boolean } = {};
  templateFieldErrors: { [paramName: string]: string } = {};
  templateResolvedAddresses: { [paramName: string]: string } = {};
  generatedContractJson = signal<string | null>(null);
  templateError = signal<string | null>(null);

  // Interact form - plain properties for ngModel
  selectedContractId = signal('');
  interactContractJson = signal('');
  interactOutpointTxid = '';
  interactOutpointVout = '';
  interactInputAmount = '';
  interactOutputAddress = '';
  interactResolvedOutputAddress: string | null = null;
  newHeirAddress = '';
  newHeirResolvedAddress: string | null = null;

  // Lookup form
  lookupContractJson = '';
  interactOutputAmount = '';
  topUpAmount = '';
  selectedFunction = '';
  useSenderFee = true;

  indexerImportQuery = '';
  indexerImportLoading = signal(false);
  indexerImportError = signal<string | null>(null);
  indexerImportPreview = signal<IndexerImportPreview | null>(null);

  // DMS keepAlive specific state
  dmsNewExpiry = ''; // new expiry timestamp (unix seconds) entered by user
  dmsKeepAliveError = signal<string | null>(null);
  interactResult = signal<{ txid: string; functionName: string } | null>(null);
  interactError = signal<string | null>(null);
  isInteracting = signal(false);

  // Extra function args (for non-sig/pubkey params like int amountToSeller in escrow arbitrate)
  extraArgValues: { [paramName: string]: string } = {};

  // Two-phase signing (multi-sig / escrow release)
  partialSpendJson = signal<string | null>(null);
  importPartialJson = '';
  isCompletingPartial = signal(false);
  partialCompleteResult = signal<{ txid: string; functionName: string } | null>(
    null,
  );
  partialCompleteError = signal<string | null>(null);

  // Computed selected contract from registry
  selectedContract = computed(() => {
    if (!this.selectedContractId()) return null;
    return this.registryContracts().find(
      (c) => c.id === this.selectedContractId(),
    );
  });

  registryContractOptions = computed<DropdownOption[]>(() =>
    this.registryContracts().map((contract) => ({
      value: contract.id,
      label: `${contract.contractName} (${this.getRegistryContractIdentityLabel(contract)})`,
      disabled: contract.status === 'spent',
    })),
  );

  // Computed parsed contract from interact JSON
  parsedInteractContract = computed(() => {
    try {
      const json =
        this.interactContractJson() || this.selectedContract()?.compiledJson;
      if (!json) return null;
      return this.covenantService.parseCompiledContract(json);
    } catch {
      return null;
    }
  });

  // Available entrypoint functions for interact
  availableFunctions = computed(() => {
    const contract = this.parsedInteractContract();
    if (!contract) return [];
    const funcs = contract.abi.filter((entry) =>
      contract.ast.functions.find((f) => f.name === entry.name && f.entrypoint),
    );

    // Inject 'transfer' action for KCC20 contracts (handled outside the standard ABI flow)
    if (
      contract.contract_name === 'KCC20' &&
      !funcs.some((f) => f.name === 'transfer')
    ) {
      funcs.push({
        name: 'transfer',
        inputs: [{ name: 'recipient', type_name: 'pubkey' }],
      } as any);
    }

    // Inject 'changeHeir' action for Dead Man's Switch contracts. This entrypoint
    // does not exist on-chain yet — see isChangeHeirFunction() — the button is a
    // UI stub until the DMS contract supports mutable heir state.
    if (
      contract.contract_name === 'DeadManSwitch' &&
      !funcs.some((f) => f.name === 'changeHeir')
    ) {
      funcs.push({
        name: 'changeHeir',
        inputs: [{ name: 'newHeir', type_name: 'pubkey' }],
      } as any);
    }

    return funcs;
  });

  /**
   * Extra (non-sig/pubkey) params for the selected function.
   * E.g., escrow arbitrate has `amountToSeller: int`.
   *
   * NOTE: This is a plain getter (not a computed signal) so that Angular's
   * change-detection re-evaluates it every cycle, picking up changes to the
   * plain string property `selectedFunction` that a computed() would not track.
   */
  extraArgsForFunction(): Array<{ name: string; type_name: string }> {
    const contract = this.parsedInteractContract();
    if (!contract || !this.selectedFunction) return [];
    const abiEntry = contract.abi.find((e) => e.name === this.selectedFunction);
    if (!abiEntry) return [];
    // For Escrow arbitrate, amountToSeller is collected via the standard
    // "Withdraw Amount (KAS)" field, so we don't render a separate input for it.
    if (
      this.selectedFunction === 'arbitrate' &&
      contract.contract_name === 'Escrow'
    )
      return [];
    if (
      contract.contract_name === 'DeadManSwitch' &&
      (this.selectedFunction === 'keepAlive' ||
        this.selectedFunction === 'withdraw')
    )
      return [];
    // Only render extra-arg inputs the interact flow can actually collect/pass
    // (collectExtraArgs + completePartialSpend handle int/bool only).
    return abiEntry.inputs.filter(
      (i) => i.type_name === 'int' || i.type_name === 'bool',
    );
  }

  onExtraArgValueChange(name: string, value: any) {
    this.extraArgValues[name] = value || '';
  }

  // Current network
  network = computed(() => this.rpcService.getNetwork());

  // --- Contract Lookup (My Contracts tab) ---
  lookupAddress = '';
  lookupLoading = signal(false);
  lookupError = signal<string | null>(null);
  lookupResult = signal<{
    address: string;
    balanceSompi: string;
    utxoCount: number;
    utxos: Array<{ txid: string; vout: number; amount: string }>;
    scriptPublicKey?: string;
  } | null>(null);

  constructor() {
    // Reload My-Contracts whenever the active network changes (also runs once now).
    effect(() => {
      this.network();
      this.loadContracts();
    });

    effect(() => {
      this.currentWallet();
      this.syncWalletOwnedTemplateFields();
      this.validateDeployAmount(false);
    });

    effect(() => {
      const contractId = this.pendingUrlImport();
      const wallet = this.currentWallet();
      this.network();
      if (!contractId || !wallet) return;

      this.pendingUrlImport.set(null);
      void this.showInboundIndexerImport(contractId);
    });
  }

  ngOnInit() {
    this.wideWorkspaceService.activate();
    this.restoreTransientState();
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const contractId = params.get('contractId');
      this.detailRouteId.set(null);
      this.detailRouteNotFound.set(false);
      if (contractId) {
        const requestedNetwork = this.route.snapshot.queryParamMap
          .get('network')
          ?.trim();
        if (requestedNetwork && requestedNetwork !== this.network()) {
          if (!this.rpcService.setNetwork(requestedNetwork)) {
            this.selectedDetailError.set(
              `This contract link targets unsupported network "${requestedNetwork}".`,
            );
            return;
          }
        }
        this.queueInboundIndexerImport(contractId);
      }
    });
    void this.applyInboundContractLink();
  }

  ngOnDestroy() {
    this.wideWorkspaceService.deactivate();
    this.routeSubscription?.unsubscribe();
  }

  private restoreTransientState() {
    const state =
      this.flowPagesService.getTransientState<ContractsTransientState>(
        'contracts',
      );
    if (!state) return;

    if (state.activeTab) this.activeTab.set(state.activeTab);
    if (state.selectedFunction !== undefined)
      this.selectedFunction = state.selectedFunction;
    if (state.interactContractJson !== undefined)
      this.interactContractJson.set(state.interactContractJson);
    if (state.interactOutpointTxid !== undefined)
      this.interactOutpointTxid = state.interactOutpointTxid;
    if (state.interactOutpointVout !== undefined)
      this.interactOutpointVout = state.interactOutpointVout;
    if (state.interactInputAmount !== undefined)
      this.interactInputAmount = state.interactInputAmount;
    if (state.interactOutputAddress !== undefined)
      this.interactOutputAddress = state.interactOutputAddress;
    if (state.interactOutputAmount !== undefined)
      this.interactOutputAmount = state.interactOutputAmount;
    if (state.topUpAmount !== undefined) this.topUpAmount = state.topUpAmount;
    if (state.partialSpendJson !== undefined)
      this.partialSpendJson.set(state.partialSpendJson);
    if (state.interactResult !== undefined)
      this.interactResult.set(state.interactResult);

    this.flowPagesService.saveTransientState('contracts', undefined);
  }

  private async applyInboundContractLink() {
    const params = this.route.snapshot.queryParamMap;
    const contractId = params.get('contract')?.trim();
    if (!contractId) return;

    const requestedNetwork = params.get('network')?.trim();
    if (
      requestedNetwork &&
      requestedNetwork !== this.network() &&
      !this.rpcService.setNetwork(requestedNetwork)
    ) {
      this.activeTab.set('lookup-import');
      this.indexerImportError.set(
        `This contract link targets unsupported network "${requestedNetwork}".`,
      );
      return;
    }

    this.queueInboundIndexerImport(contractId);
  }

  private queueInboundIndexerImport(contractId: string) {
    this.activeTab.set('lookup-import');
    this.indexerImportQuery = contractId;
    this.indexerImportError.set(null);
    this.indexerImportPreview.set(null);

    if (!this.currentWallet()) {
      this.pendingUrlImport.set(contractId);
      return;
    }

    void this.showInboundIndexerImport(contractId);
  }

  private async showInboundIndexerImport(contractId: string) {
    this.activeTab.set('lookup-import');
    this.indexerImportQuery = contractId;
    await this.lookupIndexerImport();
  }

  private findDashboardEntryForPreview(
    preview: IndexerImportPreview,
  ): ContractDashboardEntry | undefined {
    return this.dashboardContracts().find(
      (entry) =>
        this.sameIdentity(entry.covenantId, preview.covenantId) ||
        this.sameIdentity(entry.deployTxid, preview.deployTxid) ||
        this.sameIdentity(entry.scriptHash, preview.action.scriptHashHex),
    );
  }

  private async resolveIndexerImportQuery(query: string): Promise<{
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }> {
    const isHexIdentifier = /^[0-9a-fA-F]{64}$/.test(query);
    if (isHexIdentifier) {
      try {
        return await this.fetchIndexerCovenant(query);
      } catch {
        // Fall through to search/list fallback; the input may be indexed only
        // through a newer canonical/script-hash/search path.
      }
    }

    // `/covenants?q=` is the broad import fallback for covenant addresses and
    // fuzzy user input. `/explorer/search` can return template/category hits
    // that are not importable by themselves.
    const rows = await this.covenantIndexerService.listCovenants({
      q: query,
      sort: 'recent',
      limit: 10,
    });
    const supportedRows = rows.filter((item) =>
      this.supportedIndexerTemplates.includes(
        this.getIndexerTemplateName(item),
      ),
    );
    const normalizedQuery = this.normalizeIdentity(query);
    const exactRow =
      supportedRows.find(
        (item) =>
          this.normalizeIdentity(item.covenantIdHex) === normalizedQuery,
      ) ||
      supportedRows.find(
        (item) =>
          this.normalizeIdentity(item.genesisTxidHex) === normalizedQuery,
      ) ||
      supportedRows.find(
        (item) =>
          this.normalizeIdentity(item.scriptHashHex) === normalizedQuery,
      );
    if (!exactRow && supportedRows.length > 1) {
      throw new Error(
        'That address matches multiple wallet-supported covenants. Open by covenant ID or deploy transaction to choose the exact contract.',
      );
    }
    const row = exactRow || supportedRows[0];
    const identifier =
      row?.covenantIdHex || row?.scriptHashHex || row?.genesisTxidHex;
    if (identifier) {
      return await this.fetchIndexerCovenant(identifier);
    }

    const searchResults = await this.covenantIndexerService.search(query, 10);
    const concrete = searchResults.find(
      (result) =>
        (result.kind === 'covenant' || result.kind === 'transaction') &&
        !!result.id &&
        /^[0-9a-fA-F]{64}$/.test(result.id),
    );
    if (concrete?.id) {
      return await this.fetchIndexerCovenant(concrete.id);
    }

    throw new Error(
      'No importable wallet-supported covenant found for that query.',
    );
  }

  /**
   * Switch tab
   */
  switchTab(tab: TabName) {
    this.activeTab.set(tab);
    if (tab === 'my-contracts') {
      this.loadContracts();
    }
  }

  /** Nav items for the wide-workspace sidebar. */
  sidebarItems = computed<ContractsSidebarItem[]>(() => [
    {
      key: 'my-contracts',
      label: 'My Contracts',
      iconClass: 'icon-folder',
      badge: this.dashboardContracts().length,
    },
    { key: 'deploy', label: 'Create', iconClass: 'icon-add-circle' },
    { key: 'lookup-import', label: 'Import / Share', iconClass: 'icon-download' },
  ]);

  /** Active sidebar key — 'detail' maps back to 'my-contracts' (its parent section). */
  sidebarActiveKey = computed<string>(() =>
    this.activeTab() === 'detail' ? 'my-contracts' : this.activeTab(),
  );

  onSidebarSelect(key: string) {
    this.switchTab(key as TabName);
  }

  selectTemplate(template: ContractTemplate) {
    this.createMode.set('template');
    this.activeTemplate.set(template);
    // Clear all form values — prevents stale data from previous template or localStorage
    this.templateFormValues = {};
    this.templateFieldTouched = {};
    this.templateFieldErrors = {};
    this.templateResolvedAddresses = {};
    this.generatedContractJson.set(null);
    this.templateError.set(null);

    this.syncWalletOwnedTemplateFields();

    // Clear any localStorage-cached template form values to prevent stale auto-fill
    try {
      localStorage.removeItem('kaspacom_template_form_' + template.id);
    } catch {
      // localStorage may not be available
    }
  }

  private syncWalletOwnedTemplateFields() {
    const template = this.activeTemplate();
    const address =
      this.selectedAccount()?.getAddress() ||
      this.currentWallet()?.getAddress();
    if (!template || !address) return;

    for (const field of template.fields) {
      if (this.isWalletOwnedField(field)) {
        this.templateFormValues[field.paramName] = address;
      }
    }
  }

  selectCustomContract() {
    this.createMode.set('custom');
    this.activeTemplate.set(null);
    this.generatedContractJson.set(null);
    this.templateError.set(null);
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);
    this.deployContractTouched = false;
    this.deployContractError.set('');
    this.validateDeployAmount(false);
  }

  resetTemplateSelection() {
    this.activeTemplate.set(null);
    this.generatedContractJson.set(null);
    this.templateError.set(null);
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);
    this.deployContractTouched = false;
    this.deployContractError.set('');
    this.templateFieldTouched = {};
    this.templateFieldErrors = {};
    this.templateResolvedAddresses = {};
  }

  async generateContract() {
    const template = this.activeTemplate();
    if (!template) {
      this.templateError.set('Please select a template');
      return;
    }

    if (!this.validateAllTemplateFields(true)) {
      this.templateError.set(
        'Please complete the highlighted fields before deploying.',
      );
      return;
    }

    this.templateError.set(null);
    this.generatedContractJson.set(null);

    try {
      const newArgs = template.fields.map((field) =>
        this.fieldToCtorArg(field, this.getTemplateFieldValue(field)),
      );
      const compiled = await firstValueFrom(
        this.http.get<any>(template.assetPath),
      );
      const descriptor = this.templatePatcher.extractPatchDescriptor(
        compiled,
        template.placeholderArgs,
      );
      const patched = this.templatePatcher.applyPatch(
        compiled,
        descriptor,
        newArgs,
      );

      let argsPayload: any[] = [];
      let tmplName = compiled.contract_name;

      if (template.id === 'multi-sig-vault') {
        tmplName = 'MultiSigVault';
        argsPayload = [
          {
            name: 'signer1',
            type: 'address',
            value: this.getTemplateValueByName('key1'),
          },
          {
            name: 'signer2',
            type: 'address',
            value: this.getTemplateValueByName('key2'),
          },
          {
            name: 'signer3',
            type: 'address',
            value: this.getTemplateValueByName('key3'),
          },
        ];
      } else if (template.id === 'escrow-with-arbiter') {
        tmplName = 'EscrowWithArbiter';
        argsPayload = [
          {
            name: 'buyer',
            type: 'address',
            value: this.getTemplateValueByName('buyer'),
          },
          {
            name: 'seller',
            type: 'address',
            value: this.getTemplateValueByName('seller'),
          },
          {
            name: 'arbiter',
            type: 'address',
            value: this.templateFormValues['arbiterHash'],
          },
          {
            name: 'timeoutBlueScore',
            type: 'blueScore',
            value: String(
              this.parseDateToUnixMs(
                String(this.templateFormValues['expiry'] ?? '').trim(),
                'Refund Expiry Timestamp',
              ),
            ),
          },
        ];
      } else if (template.id === 'dead-mans-switch') {
        tmplName = 'DeadManSwitch';
        argsPayload = [
          {
            name: 'owner',
            type: 'address',
            value: this.getTemplateValueByName('owner'),
          },
          {
            name: 'heir',
            type: 'address',
            value: this.getTemplateValueByName('heir'),
          },
          {
            name: 'checkInDeadline',
            type: 'blueScore',
            value: String(
              this.parseDateToUnixMs(
                String(this.templateFormValues['expiry'] ?? '').trim(),
                'Check-in Deadline',
              ),
            ),
          },
        ];
      } else if (template.id === 'time-lock-vault') {
        tmplName = 'TimeLockVault';
        argsPayload = [
          {
            name: 'signer',
            type: 'address',
            value: this.getTemplateValueByName('owner'),
          },
          {
            name: 'recoveryKey',
            type: 'address',
            value: this.getTemplateValueByName('recovery'),
          },
          {
            name: 'unlockBlueScore',
            type: 'blueScore',
            value: String(
              this.parseDateToUnixMs(
                String(this.templateFormValues['timeout'] ?? '').trim(),
                'Unlock Timestamp',
              ),
            ),
          },
        ];
      }

      if (argsPayload.length > 0) {
        patched.tn10 = {
          v: 1,
          tmpl: tmplName,
          args: argsPayload,
        };
      }

      this.generatedContractJson.set(JSON.stringify(patched, null, 2));
    } catch (error: any) {
      this.templateError.set(
        error?.message || 'Failed to generate contract from template',
      );
    }
  }

  async deployTemplateContract() {
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);
    this.templateError.set(null);

    if (
      !this.validateAllTemplateFields(true) ||
      !this.validateDeployAmount(true)
    ) {
      this.templateError.set(
        'Please complete the highlighted fields before deploying.',
      );
      return;
    }

    try {
      await this.generateContract();
      const generated = this.generatedContractJson();
      if (!generated) {
        const message =
          this.templateError() || 'Failed to generate contract from template';
        this.deployError.set(message);
        return;
      }
      this.deployContractJson.set(generated);
      await this.deployContract();
    } catch (error: any) {
      const message =
        error?.message || 'Failed to prepare contract for deployment';
      this.templateError.set(message);
      this.deployError.set(message);
    }
  }

  useGeneratedContract() {
    const generated = this.generatedContractJson();
    if (!generated) {
      this.templateError.set('Generate a contract before deploying it');
      return;
    }

    this.deployContractJson.set(generated);
    this.activeTab.set('deploy');
  }

  isWalletOwnedField(field: TemplateField): boolean {
    return (
      field.type === 'address' &&
      ['owner', 'buyer', 'key1'].includes(field.paramName)
    );
  }

  getFieldHelp(field: TemplateField): string {
    if (this.isWalletOwnedField(field)) {
      return 'This is set to your currently selected wallet so the covenant remains controlled from this account.';
    }

    const help: Record<string, string> = {
      recovery:
        'A backup wallet that can recover the funds after the unlock date.',
      key2: 'A second signer. Any two configured signers can authorize a withdrawal.',
      key3: 'A third signer. Any two configured signers can authorize a withdrawal.',
      seller:
        'The seller receives funds when the buyer and seller both approve release.',
      heir: 'The beneficiary who can claim the funds if the owner misses the deadline.',
      arbiterHash:
        'Paste the arbiter address or public key. The wallet stores the required blake2b-256 hash in the covenant.',
      timeout:
        'The earliest date when the recovery wallet can use the backup withdrawal path.',
      expiry:
        this.activeTemplate()?.id === 'dead-mans-switch'
          ? 'How many days the owner can be inactive before the heir can claim.'
          : 'The deadline used by this covenant. The wallet converts this date to the timestamp format required by Kaspa.',
    };

    return help[field.paramName] || field.description;
  }

  getTemplateStepNumber(): number {
    return this.activeTemplate() ? 2 : 1;
  }

  private getTemplateFieldValue(field: TemplateField): string {
    return (
      this.templateResolvedAddresses[field.paramName] ||
      this.templateFormValues[field.paramName] ||
      ''
    );
  }

  private getTemplateValueByName(paramName: string): string {
    return (
      this.templateResolvedAddresses[paramName] ||
      this.templateFormValues[paramName] ||
      ''
    );
  }

  onDeployAmountChange(value: any) {
    this.deployAmount =
      value === null || value === undefined ? '' : String(value);
    this.deployAmountTouched = true;
    this.validateDeployAmount(false);
  }

  onDeployContractJsonChange(value: string) {
    this.deployContractJson.set(value || '');
    this.deployContractTouched = true;
    this.validateDeployContractJson(false);
  }

  validateDeployContractJson(markTouched = false): boolean {
    if (markTouched) this.deployContractTouched = true;

    const value = this.deployContractJson().trim();
    if (!value) {
      this.deployContractError.set(
        this.deployContractTouched ? 'Compiled contract JSON is required' : '',
      );
      return false;
    }

    try {
      this.covenantService.parseCompiledContract(value);
      this.deployContractError.set('');
      return true;
    } catch {
      this.deployContractError.set('Invalid compiled contract JSON');
      return false;
    }
  }

  onMaxDeployAmountClick() {
    if (this.isDeploying()) return;
    this.deployAmount = String(this.deployAvailableBalance());
    this.deployAmountTouched = true;
    this.validateDeployAmount(false);
  }

  validateDeployAmount(markTouched = false): boolean {
    if (markTouched) this.deployAmountTouched = true;

    const raw = String(this.deployAmount ?? '').trim();
    if (!raw) {
      this.deployAmountError.set(
        this.deployAmountTouched ? 'Amount is required' : '',
      );
      return false;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount)) {
      this.deployAmountError.set('Enter a valid amount');
      return false;
    }

    if (amount < this.MIN_DEPLOY_AMOUNT_KAS) {
      this.deployAmountError.set(
        `Minimum amount is ${this.MIN_DEPLOY_AMOUNT_KAS} KAS`,
      );
      return false;
    }

    if (amount > this.deployAvailableBalance()) {
      this.deployAmountError.set('Insufficient balance');
      return false;
    }

    this.deployAmountError.set('');
    return true;
  }

  onTemplateFieldChange(field: TemplateField, value: any) {
    this.templateFormValues[field.paramName] = value || '';
    this.templateFieldTouched[field.paramName] = true;
    if (field.type === 'hash32') {
      this.onHash32Input(field.paramName, value || '');
    }
    this.validateTemplateField(field);
    this.templateError.set(null);
  }

  onTemplateAddressResolved(field: TemplateField, result: any) {
    if (result?.effectiveAddress) {
      this.templateResolvedAddresses[field.paramName] = result.effectiveAddress;
      this.templateFieldErrors[field.paramName] = '';
    } else {
      delete this.templateResolvedAddresses[field.paramName];
      this.validateTemplateField(field);
    }
  }

  onTemplateAddressQrClick(field: TemplateField) {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
      return;
    }

    this.qrScannerService.startScanning({
      scannerId: `qr-scanner-covenant-${field.paramName}`,
      title: `Scan ${field.label}`,
      onSuccess: (address: string) =>
        this.onTemplateFieldChange(field, address),
      onError: (error: string) =>
        console.error('[Contracts] QR scanning error:', error),
    });
  }

  validateAllTemplateFields(markTouched = false): boolean {
    const template = this.activeTemplate();
    if (!template) return false;

    let valid = true;
    for (const field of template.fields) {
      if (markTouched) this.templateFieldTouched[field.paramName] = true;
      valid = this.validateTemplateField(field) && valid;
    }
    return valid;
  }

  validateTemplateField(field: TemplateField): boolean {
    if (this.isWalletOwnedField(field)) {
      this.syncWalletOwnedTemplateFields();
    }

    const value = String(this.templateFormValues[field.paramName] ?? '').trim();
    let error = '';

    if (!value) {
      error = `${field.label} is required`;
    } else if (field.type === 'address') {
      const resolvedAddress = this.templateResolvedAddresses[field.paramName];
      if (!this.utilsHelper.isValidWalletAddress(value) && !resolvedAddress) {
        error = 'Invalid wallet address';
      }
    } else if (field.type === 'hash32') {
      const normalized = value.replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
        error = 'Enter a Kaspa address, public key, or 32-byte hex hash';
      }
    } else if (field.type === 'int_timestamp') {
      if (!Number.isFinite(new Date(value).getTime())) {
        error = 'Select a valid date and time';
      }
    } else if (field.type === 'int_days' || field.type === 'int_count') {
      const numeric = Number(value);
      if (!Number.isInteger(numeric) || numeric < 0) {
        error = 'Enter a non-negative whole number';
      }
    }

    this.templateFieldErrors[field.paramName] = error;
    return !error;
  }

  getTemplateFieldError(field: TemplateField): string {
    return this.templateFieldTouched[field.paramName]
      ? this.templateFieldErrors[field.paramName] || ''
      : '';
  }

  isTemplateFieldValid(field: TemplateField): boolean {
    return !this.getTemplateFieldError(field);
  }

  isCreateDeployDisabled(): boolean {
    if (this.isDeploying() || !this.currentWallet()) return true;
    if (!this.isDeployAmountCompleteValid()) return true;

    if (this.createMode() === 'custom') {
      return !this.isDeployContractJsonCompleteValid();
    }

    const template = this.activeTemplate();
    if (!template) return true;

    return template.fields.some((field) => {
      const value = String(
        this.templateFormValues[field.paramName] ?? '',
      ).trim();
      return !value || !!this.templateFieldErrors[field.paramName];
    });
  }

  private isDeployAmountCompleteValid(): boolean {
    const raw = String(this.deployAmount ?? '').trim();
    if (!raw) return false;
    const amount = Number(raw);
    return (
      Number.isFinite(amount) &&
      amount >= this.MIN_DEPLOY_AMOUNT_KAS &&
      amount <= this.deployAvailableBalance()
    );
  }

  private isDeployContractJsonCompleteValid(): boolean {
    const value = this.deployContractJson().trim();
    if (!value) return false;
    try {
      this.covenantService.parseCompiledContract(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load contracts from registry and check on-chain status
   */
  async loadContracts() {
    this.dashboardLoading.set(true);
    this.dashboardError.set(null);
    if (this.activeTab() !== 'detail') {
      this.selectedDetail.set(null);
      this.selectedDetailError.set(null);
    }

    const filtered = this.getCurrentWalletLocalContracts();
    this.registryContracts.set(filtered);

    // Check on-chain status for each contract
    await this.refreshContractStatuses(filtered);

    const updatedLocal = this.getCurrentWalletLocalContracts();
    this.registryContracts.set(updatedLocal);

    try {
      // Indexer-backed tracking is the source of truth for contracts involving
      // the wallet. Local registry entries are merged below so older local-only
      // deployments still remain visible while the indexer catches up.
      const indexerEntries = await this.loadIndexerDashboardEntries();
      this.dashboardContracts.set(
        this.mergeDashboardEntries(
          indexerEntries,
          updatedLocal.map((entry) => this.localEntryToDashboard(entry)),
        ),
      );
    } catch (error: any) {
      console.warn('[Contracts] Indexer dashboard load failed:', error);
      this.dashboardError.set(
        error?.message ||
          'Indexer tracking is unavailable. Showing locally saved contracts only.',
      );
      this.dashboardContracts.set(
        updatedLocal.map((entry) => this.localEntryToDashboard(entry)),
      );
    } finally {
      this.dashboardLoading.set(false);
    }

    const routeId = this.detailRouteId();
    if (routeId) {
      await this.openDetailFromRoute(routeId);
    }
  }

  /**
   * Check on-chain UTXO status for contracts
   */
  async refreshContractStatuses(contracts: ContractRegistryEntry[]) {
    const rpc = this.rpcService.getRpc();
    if (!rpc) return;

    // Batch by unique addresses
    const addressMap = new Map<string, ContractRegistryEntry[]>();
    for (const c of contracts) {
      const list = addressMap.get(c.contractAddress) || [];
      list.push(c);
      addressMap.set(c.contractAddress, list);
    }

    for (const [address, entries] of addressMap) {
      try {
        const utxoResponse = await rpc.getUtxosByAddresses([address]);
        const utxos = utxoResponse.entries || [];

        for (const entry of entries) {
          const found = utxos.find(
            (u: any) =>
              u.outpoint?.transactionId === entry.outpoint.txid &&
              Number(u.outpoint?.index ?? -1) === entry.outpoint.vout,
          );

          const newStatus: ContractStatus = found ? 'active' : 'spent';
          if (entry.status !== newStatus) {
            this.registryService.updateContract(entry.id, {
              status: newStatus,
              lastChecked: Date.now(),
              amountSompi: found ? found.amount.toString() : entry.amountSompi,
            });
          }
        }
      } catch (err) {
        console.warn('[Contracts] Status check failed for', address, err);
      }
    }

    // Reload with updated statuses
    const updated = this.getCurrentWalletLocalContracts();
    this.registryContracts.set(updated);
  }

  private getCurrentWalletLocalContracts(): ContractRegistryEntry[] {
    return this.registryService.getAllContracts().filter((contract) => {
      if (contract.network !== this.network()) return false;
      return this.isCurrentWalletRegistryEntry(contract);
    });
  }

  private isCurrentWalletRegistryEntry(
    contract: ContractRegistryEntry,
  ): boolean {
    const wallet = this.currentWallet();
    const address = wallet?.getAddress()?.toLowerCase();
    const pubkey = wallet
      ?.getPrivateKey()
      .toPublicKey()
      .toXOnlyPublicKey()
      .toString()
      ?.toLowerCase();
    const deployedAddress = contract.deployedBy?.address?.toLowerCase();
    const deployedPubkey = contract.deployedBy?.pubkey?.toLowerCase();
    return (
      (!!address && deployedAddress === address) ||
      (!!pubkey && deployedPubkey === pubkey)
    );
  }

  private currentWalletPubkey(): string | undefined {
    return this.currentWallet()
      ?.getPrivateKey()
      .toPublicKey()
      .toXOnlyPublicKey()
      .toString();
  }

  private currentWalletPubkeyHash(): string | undefined {
    const pubkey = this.currentWalletPubkey();
    return pubkey
      ? this.computeBlake2bHex(this.hex32ToBytes(pubkey))
      : undefined;
  }

  private async loadIndexerDashboardEntries(): Promise<
    ContractDashboardEntry[]
  > {
    const wallet = this.currentWallet();
    const identifiers = [
      wallet?.getAddress(),
      this.currentWalletPubkeyHash(),
    ].filter((value): value is string => !!value);

    if (identifiers.length === 0) return [];

    const byKey = new Map<string, ContractDashboardEntry>();
    for (const identifier of identifiers) {
      // `/covenants?wallet=` matches the wallet against covenant address,
      // common participant args, and decoded constructor args. This is broader
      // than `/addresses/{address}/covenants`, which only matches P2SH covenant
      // addresses and would miss participant-owned contracts.
      const rows = await this.covenantIndexerService.listCovenants({
        wallet: identifier,
        sort: 'recent',
        limit: 100,
      });

      // Do not add `classification=covenant` here. Fresh wallet-created
      // template contracts can be indexed as `unknown/unrevealed` while still
      // carrying a trusted claimedTemplate/claimedArgs payload, so filtering by
      // classification hides the exact contracts My Contracts needs to show.
      const supportedRows = rows.filter((row) =>
        this.supportedIndexerTemplates.includes(
          this.getIndexerTemplateName(row),
        ),
      );
      const entries = supportedRows.map((row) =>
        this.indexerSummaryToDashboard(row),
      );
      for (const entry of entries) {
        byKey.set(this.getDashboardIdentityKey(entry), entry);
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => this.getEntryTime(b) - this.getEntryTime(a),
    );
  }

  private mergeDashboardEntries(
    indexerEntries: ContractDashboardEntry[],
    localEntries: ContractDashboardEntry[],
  ): ContractDashboardEntry[] {
    const merged = new Map<string, ContractDashboardEntry>();
    const hasAmount = (entry?: ContractDashboardEntry) =>
      BigInt(String(entry?.amountSompi || '0')) > 0n;
    const isMatch = (
      indexerEntry: ContractDashboardEntry,
      localEntry: ContractDashboardEntry,
    ) => {
      if (indexerEntry.covenantId && localEntry.covenantId) {
        return this.sameIdentity(
          indexerEntry.covenantId,
          localEntry.covenantId,
        );
      }
      if (indexerEntry.deployTxid && localEntry.deployTxid) {
        return this.sameIdentity(
          indexerEntry.deployTxid,
          localEntry.deployTxid,
        );
      }
      if (indexerEntry.scriptHash && localEntry.scriptHash) {
        return this.sameIdentity(
          indexerEntry.scriptHash,
          localEntry.scriptHash,
        );
      }
      return false;
    };

    for (const entry of localEntries) {
      merged.set(this.getDashboardIdentityKey(entry), entry);
    }
    for (const entry of indexerEntries) {
      const key = this.getDashboardIdentityKey(entry);
      const matchingLocalEntries = Array.from(merged.values()).filter(
        (candidate) => isMatch(entry, candidate),
      );
      const local =
        matchingLocalEntries.find(
          (candidate) => candidate.status === 'spent',
        ) ||
        matchingLocalEntries.find(hasAmount) ||
        matchingLocalEntries[0];

      for (const matchedLocal of matchingLocalEntries) {
        merged.delete(this.getDashboardIdentityKey(matchedLocal));
      }

      merged.set(local?.id || key, {
        ...entry,
        source: local ? 'both' : entry.source,
        status: entry.status,
        amountSompi: entry.amountSompi,
        latestTxid: entry.latestTxid,
        latestAction: entry.latestAction,
        registryEntry: local?.registryEntry,
      });
    }

    return Array.from(merged.values()).sort(
      (a, b) => this.getEntryTime(b) - this.getEntryTime(a),
    );
  }

  private localEntryToDashboard(
    contract: ContractRegistryEntry,
  ): ContractDashboardEntry {
    const contractName = this.normalizeContractName(contract.contractName);
    const participants = this.localParticipants(contract);
    return {
      id: `local:${contract.id}`,
      source: 'local',
      contractName,
      displayName: this.getTemplateDisplayName(contractName),
      status: contract.status || 'unknown',
      amountSompi: contract.amountSompi,
      currentAddress: contract.contractAddress,
      covenantId: contract.covenantId,
      deployTxid: contract.deployTxid,
      latestTxid:
        contract.spendTxid || contract.outpoint?.txid || contract.deployTxid,
      latestAction: contract.spendTxid ? 'spend' : 'deploy',
      participants,
      nextActionLabel: this.getNextActionLabel(
        contractName,
        contract.status || 'unknown',
        participants,
      ),
      actionHint: 'Open wallet action flow',
      registryEntry: contract,
    };
  }

  private indexerSummaryToDashboard(
    summary: IndexerCovenantDetails,
  ): ContractDashboardEntry {
    const contractName = this.getIndexerTemplateName(summary);
    const participants = this.indexerParticipants(summary);
    const status = this.statusFromActiveUtxoCount(summary.activeUtxos);
    return {
      id: `indexer:${summary.covenantIdHex || summary.scriptHashHex}`,
      source: 'indexer',
      contractName,
      displayName: this.getTemplateDisplayName(contractName),
      status,
      amountSompi: String(summary.totalAmountSompi ?? '0'),
      currentAddress: summary.address,
      covenantId: summary.covenantIdHex,
      scriptHash: summary.scriptHashHex,
      deployTxid: summary.genesisTxidHex,
      latestTxid: summary.genesisTxidHex,
      latestAction: 'deploy',
      deadlineMs: this.extractDeadlineMs(summary),
      participants,
      nextActionLabel: this.getNextActionLabel(
        contractName,
        status,
        participants,
      ),
      actionHint:
        summary.claimVerified === false
          ? 'Template claim is not verified on-chain yet'
          : 'Open current covenant state',
      indexerSummary: summary,
    };
  }

  private latestAction(
    actions: IndexerCovenantAction[],
  ): IndexerCovenantAction | undefined {
    return [...actions].sort(
      (a, b) => (b.blockTimeMs || 0) - (a.blockTimeMs || 0),
    )[0];
  }

  private getIndexerTemplateName(summary: IndexerCovenantDetails): string {
    return this.normalizeContractName(
      summary.template ||
        summary.claimedTemplate ||
        summary.claimedArgs?.tmpl ||
        'Covenant',
    );
  }

  private normalizeContractName(name: string): string {
    const normalized = String(name || '').replace(/\s+/g, '');
    const aliases: Record<string, string> = {
      DeadMansSwitch: 'DeadManSwitch',
      "DeadMan'sSwitch": 'DeadManSwitch',
      TimeLockVault: 'TimeLockVault',
      MultiSigVault: 'MultiSigVault',
      Escrow: 'EscrowWithArbiter',
    };
    return aliases[normalized] || normalized;
  }

  private getTemplateDisplayName(name: string): string {
    const labels: Record<string, string> = {
      DeadManSwitch: "Dead Man's Switch",
      TimeLockVault: 'Time Lock',
      MultiSigVault: 'MultiSig',
      EscrowWithArbiter: 'Escrow',
    };
    return labels[this.normalizeContractName(name)] || name || 'Covenant';
  }

  private getRegistryContractIdentityLabel(
    contract: ContractRegistryEntry,
  ): string {
    const primary =
      contract.covenantId ||
      contract.deployTxid ||
      `${contract.outpoint.txid}:${contract.outpoint.vout}`;
    return this.truncate(primary, 20);
  }

  private localParticipants(
    contract: ContractRegistryEntry,
  ): Array<{ label: string; value: string }> {
    const participants = [
      {
        label: 'Owner',
        value: contract.deployedBy.address || contract.deployedBy.pubkey,
      },
    ];
    const predecessor = contract.predecessorId
      ? this.registryService.getContract(contract.predecessorId)
      : undefined;
    if (
      predecessor?.deployedBy?.address &&
      predecessor.deployedBy.address !== contract.deployedBy.address
    ) {
      participants.push({
        label: 'Original owner',
        value: predecessor.deployedBy.address,
      });
    }
    return participants;
  }

  private indexerParticipants(
    summary: IndexerCovenantDetails,
  ): Array<{ label: string; value: string }> {
    const source = {
      ...(summary.constructor || {}),
      ...this.argsArrayToRecord(summary.claimedArgs?.args || []),
    };
    const roles = [
      'owner',
      'heir',
      'signer',
      'recovery',
      'key1',
      'key2',
      'key3',
      'buyer',
      'seller',
      'arbiter',
      'arbiterHash',
    ];
    return roles
      .filter(
        (role) =>
          source[role] !== undefined &&
          source[role] !== null &&
          source[role] !== '',
      )
      .map((role) => ({
        label: this.roleLabel(role),
        value: String(source[role]),
      }));
  }

  private argsArrayToRecord(
    args: IndexerCovenantArg[],
  ): Record<string, string> {
    return args.reduce<Record<string, string>>((record, arg) => {
      record[arg.name] = String(arg.value);
      return record;
    }, {});
  }

  private roleLabel(role: string): string {
    const labels: Record<string, string> = {
      owner: 'Owner',
      heir: 'Heir',
      signer: 'Owner',
      recovery: 'Recovery',
      key1: 'Signer 1',
      key2: 'Signer 2',
      key3: 'Signer 3',
      buyer: 'Buyer',
      seller: 'Seller',
      arbiter: 'Arbiter',
      arbiterHash: 'Arbiter',
    };
    return labels[role] || role;
  }

  getContractDetailParameters(
    detail: ContractDetailState,
  ): ContractDetailParameter[] {
    const covenant = detail.response?.covenant || detail.entry.indexerSummary;
    const params: ContractDetailParameter[] = [];
    const seen = new Set<string>();
    const addParam = (name: string, value: unknown, type?: string) => {
      if (value === undefined || value === null || value === '') return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      params.push({
        label: this.roleLabel(name),
        value: String(value),
        type,
      });
    };

    for (const arg of covenant?.claimedArgs?.args || []) {
      addParam(arg.name, arg.value, arg.type);
    }

    const constructorArgs = covenant?.constructor || {};
    for (const [name, value] of Object.entries(constructorArgs)) {
      addParam(name, value);
    }

    if (params.length > 0) {
      return params;
    }

    return detail.entry.participants.map((participant) => ({
      label: participant.label,
      value: participant.value,
    }));
  }

  private getNextActionLabel(
    contractName: string,
    status: ContractDashboardEntry['status'],
    participants: Array<{ label: string; value: string }>,
  ): string {
    if (status !== 'active') return 'View history';
    const normalized = this.normalizeContractName(contractName);
    const currentRole = this.currentWalletRole(participants);
    if (normalized === 'DeadManSwitch')
      return currentRole === 'Owner' ? 'Keep Alive' : 'Claim';
    if (normalized === 'TimeLockVault')
      return currentRole === 'Recovery' ? 'Recover' : 'Withdraw';
    if (normalized === 'MultiSigVault')
      return currentRole.startsWith('Signer')
        ? 'Sign / Complete'
        : 'Open Actions';
    if (normalized === 'EscrowWithArbiter') {
      if (currentRole === 'Arbiter') return 'Arbitrate';
      if (currentRole === 'Buyer') return 'Release / Refund';
      if (currentRole === 'Seller') return 'Release';
    }
    return 'Open Actions';
  }

  private currentWalletRole(
    participants: Array<{ label: string; value: string }>,
  ): string {
    const wallet = this.currentWallet();
    const candidates = [
      wallet?.getAddress(),
      this.currentWalletPubkey(),
      this.currentWalletPubkeyHash(),
    ]
      .filter((value): value is string => !!value)
      .map((value) => value.toLowerCase());

    return (
      participants.find((participant) =>
        candidates.includes(String(participant.value).toLowerCase()),
      )?.label || ''
    );
  }

  /** Public wrapper for the detail page's "You are <role>" pill. */
  getCurrentRoleLabel(participants: Array<{ label: string; value: string }>): string {
    return this.currentWalletRole(participants);
  }

  private extractDeadlineMs(
    summary: IndexerCovenantDetails,
  ): number | undefined {
    const source = {
      ...(summary.constructor || {}),
      ...this.argsArrayToRecord(summary.claimedArgs?.args || []),
    };
    const raw =
      source['checkInDeadline'] ??
      source['expiry'] ??
      source['timeout'] ??
      source['timeoutBlueScore'] ??
      source['unlockBlueScore'];
    if (raw === undefined || raw === null || raw === '') return undefined;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
    if (numeric > 946684800000) return numeric;
    if (numeric > 946684800) return numeric * 1000;
    return undefined;
  }

  private getEntryTime(entry: ContractDashboardEntry): number {
    return (
      entry.indexerSummary?.createdAtMs || entry.registryEntry?.deployedAt || 0
    );
  }

  async openContractDetail(entry: ContractDashboardEntry) {
    this.selectedDetailLoading.set(true);
    this.selectedDetailError.set(null);
    this.selectedDetail.set({ entry, actions: [], utxos: [] });
    if (this.detailRouteId() || this.activeTab() === 'detail') {
      this.clearInteractContractSelection();
    }
    this.scrollContractsContentToTop();

    const identifier = entry.covenantId || entry.scriptHash || entry.deployTxid;
    if (!identifier) {
      this.selectedDetailLoading.set(false);
      this.selectedDetailError.set(
        'This local contract has no indexer id or deploy transaction yet. Use the action flow or import by tx once indexed.',
      );
      return;
    }

    try {
      const resolved = await this.fetchIndexerCovenant(identifier);
      const detailIdentifier =
        resolved.covenant?.covenantIdHex ||
        resolved.covenant?.scriptHashHex ||
        entry.covenantId ||
        entry.scriptHash;
      const [actions, utxos] = detailIdentifier
        ? await Promise.all([
            this.covenantIndexerService.getCovenantActions(detailIdentifier),
            this.covenantIndexerService.getCovenantUtxos(detailIdentifier),
          ])
        : [resolved.actions, [] as IndexerCovenantUtxo[]];
      const response: IndexerCovenantResponse = {
        actions,
        covenant: resolved.covenant,
      };
      const latestAction = this.latestAction(actions);
      const lockedSompi = utxos.reduce(
        (total, utxo) => total + BigInt(String(utxo.amountSompi ?? 0)),
        0n,
      );
      const resolvedStatus = detailIdentifier
        ? this.statusFromActiveUtxoCount(utxos.length)
        : entry.status;
      const updatedEntry: ContractDashboardEntry = {
        ...entry,
        latestTxid: latestAction?.txidHex || entry.latestTxid,
        latestAction:
          latestAction?.entrypoint ||
          latestAction?.action ||
          entry.latestAction,
        covenantId: resolved.covenant?.covenantIdHex || entry.covenantId,
        scriptHash: resolved.covenant?.scriptHashHex || entry.scriptHash,
        status: resolvedStatus,
        amountSompi: detailIdentifier
          ? lockedSompi.toString()
          : entry.amountSompi,
      };
      this.selectedDetail.set({
        entry: updatedEntry,
        response,
        actions,
        utxos,
      });
      if (
        (this.detailRouteId() || this.activeTab() === 'detail') &&
        updatedEntry.status === 'active'
      ) {
        await this.prepareDashboardAction(updatedEntry);
      }
    } catch (error: any) {
      this.selectedDetailError.set(
        error?.message || 'Failed to load indexer detail for this contract.',
      );
    } finally {
      this.selectedDetailLoading.set(false);
      this.scrollContractsContentToTop();
    }
  }

  async openDashboardAction(entry: ContractDashboardEntry) {
    this.detailPanelTab.set('action');
    this.activeTab.set('detail');
    await this.openContractDetail(entry);
  }

  /** Same as openDashboardAction(), but preselects a specific entrypoint instead of the type's default. */
  async openDashboardActionFor(entry: ContractDashboardEntry, fnName: string) {
    await this.openDashboardAction(entry);
    if (this.availableFunctions().some((fn) => fn.name === fnName)) {
      this.selectFunction(fnName);
    }
  }

  private async prepareDashboardAction(
    entry: ContractDashboardEntry,
  ): Promise<boolean> {
    if (entry.registryEntry) {
      const registryEntry = this.syncRegistryEntryForDashboardAction(entry);
      this.selectedContractId.set(registryEntry.id);
      this.selectContractFromRegistry();
      this.selectDefaultFunctionForContract(entry.contractName);
      return true;
    }

    this.dashboardError.set(null);

    if (entry.status === 'tracking-incomplete') {
      this.dashboardError.set(
        'Actions are disabled because the indexer reports multiple active UTXOs for this covenant. Open details and choose a specific UTXO once the wallet supports UTXO selection.',
      );
      this.detailPanelTab.set('details');
      return false;
    }

    const identifier = entry.covenantId || entry.scriptHash || entry.deployTxid;
    if (!identifier) {
      this.dashboardError.set(
        'This contract cannot be opened for actions until it has an indexer covenant id, script hash, or deploy transaction.',
      );
      return false;
    }

    try {
      this.selectedDetailLoading.set(true);
      const response = await this.fetchIndexerCovenant(identifier);
      const preview = await this.buildIndexerImportPreview(response);
      this.indexerImportPreview.set(preview);
      this.importIndexerPreview({ stayOnCurrentTab: true });
      const imported = this.registryService
        .getAllContracts()
        .find(
          (contract) =>
            contract.network === this.network() &&
            this.isCurrentWalletRegistryEntry(contract) &&
            (this.sameIdentity(contract.covenantId, preview.covenantId) ||
              (this.sameIdentity(
                contract.outpoint.txid,
                preview.outpoint.txid,
              ) &&
                contract.outpoint.vout === preview.outpoint.vout)),
        );
      if (imported) {
        this.selectedContractId.set(imported.id);
        this.selectContractFromRegistry();
        this.selectDefaultFunctionForContract(entry.contractName);
        this.activeTab.set('detail');
        this.detailPanelTab.set('action');
        return true;
      }
    } catch (error: any) {
      this.dashboardError.set(
        error?.message || 'Import this contract before using wallet actions.',
      );
    } finally {
      this.selectedDetailLoading.set(false);
    }
    return false;
  }

  private syncRegistryEntryForDashboardAction(
    entry: ContractDashboardEntry,
  ): ContractRegistryEntry {
    const registryEntry = entry.registryEntry!;
    const detail = this.selectedDetail();
    const activeUtxo = detail?.utxos.length === 1 ? detail.utxos[0] : undefined;
    const amountSompi = String(
      activeUtxo?.amountSompi ?? entry.amountSompi ?? registryEntry.amountSompi,
    );
    const contractAddress =
      activeUtxo?.address ||
      entry.currentAddress ||
      registryEntry.contractAddress;

    const updates: Partial<ContractRegistryEntry> = {
      amountSompi,
      contractAddress,
      covenantId: entry.covenantId || registryEntry.covenantId,
      deployTxid: entry.deployTxid || registryEntry.deployTxid,
      lastChecked: Date.now(),
      status:
        entry.status === 'active' ||
        entry.status === 'spent' ||
        entry.status === 'unknown'
          ? entry.status
          : registryEntry.status,
    };

    if (activeUtxo?.txidHex && activeUtxo.vout !== undefined) {
      updates.outpoint = {
        txid: activeUtxo.txidHex,
        vout: Number(activeUtxo.vout),
      };
    }

    this.registryService.updateContract(registryEntry.id, updates);
    const updatedEntry = { ...registryEntry, ...updates };
    this.registryContracts.set(
      this.registryContracts().map((contract) =>
        contract.id === updatedEntry.id ? updatedEntry : contract,
      ),
    );
    return updatedEntry;
  }

  setDashboardFilter(filter: ContractDashboardFilter) {
    this.dashboardFilter.set(filter);
    this.selectedDetail.set(null);
    this.selectedDetailError.set(null);
  }

  setStatusFilter(filter: ContractStatusFilter) {
    this.statusFilter.set(filter);
    this.selectedDetail.set(null);
    this.selectedDetailError.set(null);
  }

  private scrollContractsContentToTop() {
    setTimeout(() => {
      document
        .querySelector<HTMLElement>('.contracts-container')
        ?.scrollTo({ top: 0, behavior: 'auto' });
      document
        .querySelector<HTMLElement>('.flow-page-body')
        ?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  navigateToContractDetail(entry: ContractDashboardEntry) {
    this.detailPanelTab.set('details');
    this.activeTab.set('detail');
    void this.openContractDetail(entry);
  }

  setContractDetailTab(tab: ContractDetailTab) {
    if (tab === 'action' && this.selectedDetail()?.entry.status === 'spent')
      return;
    this.detailPanelTab.set(tab);
    this.scrollContractsContentToTop();
  }

  backToContractsList() {
    const wasRouteDetail = !!this.detailRouteId();
    if (wasRouteDetail) {
      void this.router.navigate(['/app/contracts']);
    }
    this.selectedDetail.set(null);
    this.selectedDetailError.set(null);
    this.detailRouteId.set(null);
    this.detailRouteNotFound.set(false);
    this.activeTab.set('my-contracts');
  }

  private async openDetailFromRoute(routeId: string) {
    if (this.dashboardLoading()) return;

    const entry = this.findDashboardEntryByRouteId(routeId);
    if (entry) {
      this.detailRouteNotFound.set(false);
      await this.openContractDetail(entry);
      return;
    }

    try {
      this.selectedDetailLoading.set(true);
      const response = await this.resolveIndexerImportQuery(routeId);
      const preview = await this.buildIndexerImportPreview(response);
      const existing = this.findDashboardEntryForPreview(preview);
      this.detailRouteNotFound.set(false);
      await this.openContractDetail(
        existing || this.indexerPreviewToDashboard(preview, response),
      );
    } catch (error: any) {
      this.detailRouteNotFound.set(true);
      this.selectedDetail.set(null);
      this.selectedDetailError.set(
        error?.message ||
          'Contract not found for this wallet or indexer network.',
      );
      this.selectedDetailLoading.set(false);
    }
  }

  private findDashboardEntryByRouteId(
    routeId: string,
  ): ContractDashboardEntry | undefined {
    const normalizedRouteId = this.normalizeIdentity(routeId);
    return this.dashboardContracts().find(
      (entry) =>
        this.normalizeIdentity(this.getContractRouteId(entry)) ===
          normalizedRouteId ||
        this.normalizeIdentity(entry.deployTxid) === normalizedRouteId ||
        this.normalizeIdentity(entry.scriptHash) === normalizedRouteId,
    );
  }

  private getContractRouteId(entry: ContractDashboardEntry): string {
    return entry.covenantId || entry.scriptHash || entry.deployTxid || entry.id;
  }

  private getDashboardIdentityKey(entry: ContractDashboardEntry): string {
    return (
      this.normalizeIdentity(entry.covenantId) ||
      this.normalizeIdentity(entry.deployTxid) ||
      this.normalizeIdentity(entry.scriptHash) ||
      entry.id
    );
  }

  private sameIdentity(left?: string, right?: string): boolean {
    const normalizedLeft = this.normalizeIdentity(left);
    const normalizedRight = this.normalizeIdentity(right);
    return !!normalizedLeft && normalizedLeft === normalizedRight;
  }

  private normalizeIdentity(value?: string): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private clearInteractContractSelection() {
    this.selectedContractId.set('');
    this.interactContractJson.set('');
    this.interactOutpointTxid = '';
    this.interactOutpointVout = '';
    this.interactInputAmount = '';
    this.selectedFunction = '';
    this.interactError.set(null);
    this.interactResult.set(null);
    this.partialSpendJson.set(null);
    this.partialCompleteError.set(null);
    this.partialCompleteResult.set(null);
  }

  /** Per-(contract type, entrypoint) authored copy + availability rules for the detail page's action list. */
  private readonly actionMetaTable: Record<
    string,
    Record<
      string,
      {
        label: string;
        description: string;
        iconClass: string;
        requiredRole?: string;
        extraGuard?: (detail: ContractDetailState) => string | null;
      }
    >
  > = {
    DeadManSwitch: {
      keepAlive: {
        label: 'Keep alive',
        description: 'Reset the check-in deadline and keep the funds yours.',
        iconClass: 'icon-refresh-ccw-04',
        requiredRole: 'Owner',
      },
      withdraw: {
        label: 'Withdraw',
        description:
          'Withdraw part of the locked funds using the owner key.',
        iconClass: 'icon-coins-02',
        requiredRole: 'Owner',
      },
      claim: {
        label: 'Claim',
        description: 'Claim the inheritance as the designated heir.',
        iconClass: 'icon-gift',
        requiredRole: 'Heir',
        extraGuard: (detail) => {
          const deadline = detail.entry.deadlineMs;
          if (deadline && Date.now() < deadline) {
            return 'Only the heir, only after the check-in deadline passes.';
          }
          return null;
        },
      },
    },
    TimeLockVault: {
      spend: {
        label: 'Withdraw',
        description: 'Withdraw funds using the owner key.',
        iconClass: 'icon-coins-02',
        requiredRole: 'Owner',
      },
      recover: {
        label: 'Recover',
        description: 'Emergency withdrawal using the recovery key.',
        iconClass: 'icon-shield',
        requiredRole: 'Recovery',
        extraGuard: (detail) => {
          const deadline = detail.entry.deadlineMs;
          if (deadline && Date.now() < deadline) {
            return 'Only the recovery wallet, only after the timelock expires.';
          }
          return null;
        },
      },
    },
    MultiSigVault: {
      spend12: {
        label: '2-of-3 Withdraw',
        description:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from two key holders.',
        iconClass: 'icon-coins-02',
      },
      spend: {
        label: 'Owner Withdraw',
        description: 'Withdraw immediately using the owner key.',
        iconClass: 'icon-coins-02',
        requiredRole: 'Owner',
      },
    },
    EscrowWithArbiter: {
      release: {
        label: 'Release',
        description:
          'Both buyer and seller agree to release funds to the recipient.',
        iconClass: 'icon-send-01',
      },
      refund: {
        label: 'Refund',
        description: 'Cancel the escrow and return funds to the sender.',
        iconClass: 'icon-coins-02',
      },
      arbitrate: {
        label: 'Arbitrate',
        description: 'Resolve the dispute as the trusted arbiter.',
        iconClass: 'icon-shield',
        requiredRole: 'Arbiter',
      },
    },
  };

  /**
   * Full list of possible actions for the detail page's "Available actions"
   * panel — unlike getNextActionLabel() (one suggestion), this returns every
   * entrypoint the contract type supports, each flagged enabled/disabled with
   * a human-readable reason so the user understands why an action is greyed
   * out (wrong role, or a state condition like an unpassed deadline).
   */
  getAvailableActions(detail: ContractDetailState): AvailableAction[] {
    const normalized = this.normalizeContractName(detail.entry.contractName);
    const table = this.actionMetaTable[normalized];
    if (!table) return [];

    const available = this.availableFunctions();
    const currentRole = this.currentWalletRole(detail.entry.participants);

    return Object.entries(table).map(([fnName, meta]) => {
      const existsOnChain =
        available.length === 0 || available.some((fn) => fn.name === fnName);

      let disabledReason: string | null = null;
      if (!existsOnChain) {
        disabledReason = 'Not available on this contract version.';
      } else if (
        meta.requiredRole &&
        currentRole &&
        currentRole !== meta.requiredRole
      ) {
        disabledReason = `Only the ${meta.requiredRole.toLowerCase()} can do this.`;
      } else {
        disabledReason = meta.extraGuard?.(detail) ?? null;
      }

      return {
        fnName,
        label: meta.label,
        description: meta.description,
        iconClass: meta.iconClass,
        enabled: !disabledReason,
        disabledReason: disabledReason ?? undefined,
      };
    });
  }

  private selectDefaultFunctionForContract(contractName: string) {
    const normalized = this.normalizeContractName(contractName);
    const preferred: Record<string, string[]> = {
      DeadManSwitch: ['keepAlive', 'withdraw', 'claim'],
      TimeLockVault: ['spend', 'recover', 'withdraw'],
      MultiSigVault: ['spend12', 'spend', 'release'],
      EscrowWithArbiter: ['release', 'refund', 'arbitrate'],
    };
    const available = this.availableFunctions();
    const target =
      (preferred[normalized] || []).find((name) =>
        available.some((fn) => fn.name === name),
      ) || available[0]?.name;
    if (target) this.selectFunction(target);
  }

  onIndexerImportQueryChange(value: any) {
    this.indexerImportQuery = value || '';
  }

  async lookupIndexerImport() {
    const query = this.indexerImportQuery.trim();
    this.indexerImportError.set(null);
    this.indexerImportPreview.set(null);

    if (!query) {
      this.indexerImportError.set(
        'Enter a covenant ID, script hash, transaction ID, contract address, or share-link value.',
      );
      return;
    }

    try {
      this.indexerImportLoading.set(true);
      const response = await this.resolveIndexerImportQuery(query);
      const preview = await this.buildIndexerImportPreview(response);
      this.indexerImportPreview.set(preview);
    } catch (error: any) {
      console.warn('[Contracts] Indexer import lookup failed:', error);
      this.indexerImportError.set(
        error?.message || 'Failed to load covenant from indexer',
      );
    } finally {
      this.indexerImportLoading.set(false);
    }
  }

  importIndexerPreview(options: { stayOnCurrentTab?: boolean } = {}) {
    const preview = this.indexerImportPreview();
    if (!preview) {
      this.indexerImportError.set('Look up a covenant before importing it.');
      return;
    }

    const existing = this.registryService.getAllContracts().find((entry) => {
      if (entry.network !== this.network()) return false;
      if (!this.isCurrentWalletRegistryEntry(entry)) return false;
      const sameOutpoint =
        this.sameIdentity(entry.outpoint.txid, preview.outpoint.txid) &&
        entry.outpoint.vout === preview.outpoint.vout;
      if (sameOutpoint) return true;

      return (
        this.sameIdentity(entry.covenantId, preview.covenantId) ||
        this.sameIdentity(entry.deployTxid, preview.deployTxid)
      );
    });
    if (existing) {
      this.indexerImportError.set('This covenant is already in My Contracts.');
      this.indexerImportPreview.set(null);
      if (!options.stayOnCurrentTab) {
        this.activeTab.set('my-contracts');
      }
      return;
    }

    const wallet = this.currentWallet();
    const compiled = this.covenantService.parseCompiledContract(
      preview.compiledJson,
    );
    const entry: ContractRegistryEntry = {
      id: this.registryService.generateId(),
      contractName: compiled.contract_name || preview.template.name,
      compiledJson: preview.compiledJson,
      deployTxid: preview.deployTxid,
      contractAddress: preview.contractAddress,
      outpoint: preview.outpoint,
      amountSompi: preview.amountSompi,
      deployedBy: {
        address: wallet?.getAddress() || '',
        pubkey:
          wallet?.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString() ||
          '',
        accountName: wallet?.getDisplayName() || 'Imported',
      },
      deployedAt: preview.deployedAt,
      network: this.network(),
      status: 'active',
      accessRoles: this.parseAccessRoles(compiled),
      covenantId: preview.covenantId,
    };

    this.registryService.addContract(entry);
    this.indexerImportQuery = '';
    this.indexerImportPreview.set(null);
    if (!options.stayOnCurrentTab) {
      this.activeTab.set('my-contracts');
    }
    this.loadContracts();
  }

  private indexerPreviewToDashboard(
    preview: IndexerImportPreview,
    response: {
      action: IndexerCovenantAction;
      actions: IndexerCovenantAction[];
      covenant?: IndexerCovenantDetails;
    },
  ): ContractDashboardEntry {
    const contractName = this.normalizeContractName(
      preview.templateName || preview.template.name,
    );
    const latestAction =
      this.latestAction(response.actions) ||
      preview.activeAction ||
      response.action;
    const status = this.statusFromActiveUtxoCount(
      response.covenant?.activeUtxos,
    );
    const participants = response.covenant
      ? this.indexerParticipants(response.covenant)
      : preview.args.map((arg) => ({
          label: this.roleLabel(arg.name),
          value: String(arg.value),
        }));

    return {
      id: `indexer:${preview.covenantId}`,
      source: 'indexer',
      contractName,
      displayName: this.getTemplateDisplayName(contractName),
      status,
      amountSompi: preview.amountSompi,
      currentAddress: preview.contractAddress,
      covenantId: preview.covenantId,
      scriptHash:
        response.covenant?.scriptHashHex ||
        preview.activeAction.scriptHashHex ||
        response.action.scriptHashHex,
      deployTxid: preview.deployTxid,
      latestTxid: latestAction?.txidHex || preview.deployTxid,
      latestAction:
        latestAction?.entrypoint || latestAction?.action || 'deploy',
      deadlineMs: response.covenant
        ? this.extractDeadlineMs(response.covenant)
        : undefined,
      participants,
      nextActionLabel: this.getNextActionLabel(
        contractName,
        status,
        participants,
      ),
      actionHint: preview.isLatestContinuation
        ? 'Open latest continuation state'
        : 'Open current covenant state',
      indexerSummary: response.covenant,
    };
  }

  private statusFromActiveUtxoCount(
    activeUtxos: number | undefined,
  ): ContractDashboardEntry['status'] {
    if (activeUtxos === 0) return 'spent';
    if (activeUtxos === 1) return 'active';

    // The current wallet action flow spends one selected outpoint. If the
    // indexer reports multiple active UTXOs, showing the contract is fine but
    // auto-selecting one for a spend would be unsafe until a UTXO picker exists.
    return 'tracking-incomplete';
  }

  private async fetchIndexerCovenant(identifier: string): Promise<{
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }> {
    try {
      const byCovenant = await this.fetchIndexerCovenantByIdOrHash(identifier);
      const deployAction =
        (byCovenant.actions || []).find(
          (action) => action.action === 'deploy',
        ) || byCovenant.actions?.[0];
      if (deployAction) {
        return await this.resolveLatestIndexerCovenant({
          action: deployAction,
          actions: byCovenant.actions || [deployAction],
          covenant: byCovenant.covenant,
        });
      }
    } catch {
      // Try tx lookup below; the identifier may be a deploy transaction id.
    }

    const byTx =
      await this.covenantIndexerService.getTransactionActions(identifier);
    const deployAction =
      byTx.find((action) => action.action === 'deploy') || byTx[0];
    if (!deployAction) {
      throw new Error('No covenant deploy action found for that identifier.');
    }

    if (deployAction.covenantIdHex) {
      try {
        const byCovenant = await this.fetchIndexerCovenantByIdOrHash(
          deployAction.covenantIdHex,
        );
        const canonicalDeploy =
          (byCovenant.actions || []).find(
            (action) => action.action === 'deploy',
          ) || deployAction;
        return await this.resolveLatestIndexerCovenant({
          action: canonicalDeploy,
          actions: byCovenant.actions || [canonicalDeploy],
          covenant: byCovenant.covenant,
        });
      } catch {
        return { action: deployAction, actions: byTx };
      }
    }

    return { action: deployAction, actions: byTx };
  }

  private async fetchIndexerCovenantByIdOrHash(
    identifier: string,
  ): Promise<IndexerCovenantResponse> {
    try {
      return await this.covenantIndexerService.getCovenantByCanonicalId(
        identifier,
      );
    } catch {
      return await this.covenantIndexerService.getCovenant(identifier);
    }
  }

  private async resolveLatestIndexerCovenant(response: {
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }): Promise<{
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }> {
    const latestAction = this.getLatestCovenantOutputAction(response.actions);
    const latestScriptHash = this.extractScriptHashFromScriptPubKey(
      latestAction?.outputs?.scriptPubKeyHex,
    );
    if (
      !latestScriptHash ||
      latestScriptHash === response.covenant?.scriptHashHex
    ) {
      return response;
    }

    try {
      const latest =
        await this.fetchIndexerCovenantByIdOrHash(latestScriptHash);
      const latestDeploy =
        (latest.actions || []).find((action) => action.action === 'deploy') ||
        latest.actions?.[0];
      if (
        latestDeploy &&
        (latest.covenant?.claimedTemplate || latest.covenant?.claimedArgs?.tmpl)
      ) {
        return {
          action: latestDeploy,
          actions: latest.actions || [latestDeploy],
          covenant: latest.covenant,
        };
      }
    } catch {
      // Fall back to the canonical response; the preview will explain if it cannot be reconstructed.
    }

    return response;
  }

  private async buildIndexerImportPreview(response: {
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }): Promise<IndexerImportPreview> {
    const { action, actions, covenant } = response;
    const activeAction = this.getLatestCovenantOutputAction(actions) || action;
    const covenantId = covenant?.covenantIdHex || action.covenantIdHex;
    const deployTxid =
      activeAction.txidHex || covenant?.genesisTxidHex || action.txidHex;
    const contractAddress =
      activeAction.outputs?.address ||
      activeAction.address ||
      covenant?.address ||
      action.address ||
      action.outputs?.address;
    const amountSompi = String(
      activeAction.outputs?.amountSompi ??
        covenant?.totalAmountSompi ??
        action.outputs?.amountSompi ??
        '',
    );
    const vout = Number(
      activeAction.outputs?.vout ?? action.outputs?.vout ?? 0,
    );
    const templateName =
      covenant?.claimedTemplate || covenant?.claimedArgs?.tmpl;
    const args = covenant?.claimedArgs?.args || [];

    if (!covenantId || !deployTxid || !contractAddress || !amountSompi) {
      throw new Error(
        'Indexer response is missing covenant id, deploy transaction, address, or amount.',
      );
    }
    if (!templateName || args.length === 0) {
      throw new Error(
        'This covenant has no revealed template claim, so it cannot be imported.',
      );
    }

    const template =
      this.templateForIndexerName(templateName) ||
      this.templateForIndexerArgs(args);
    if (!template) {
      throw new Error(
        `Unsupported covenant template "${templateName}". Only local wallet templates can be imported.`,
      );
    }

    const fieldValues = this.indexerArgsToTemplateValues(template, args);
    const compiled = await this.compileTemplateWithFieldValues(
      template,
      fieldValues,
    );
    const computedAddress = this.covenantService.getContractAddress(compiled);
    const isLatestContinuation =
      !!activeAction.outputs?.address &&
      activeAction.outputs.address !== computedAddress;
    if (computedAddress !== contractAddress) {
      throw new Error(
        'Template parameters do not match the covenant address reported by the indexer.',
      );
    }

    return {
      action,
      activeAction,
      args,
      compiledJson: JSON.stringify(compiled, null, 2),
      contractAddress,
      covenantId,
      deployTxid,
      fieldValues,
      outpoint: { txid: deployTxid, vout },
      template,
      templateName,
      amountSompi,
      deployedAt:
        activeAction.blockTimeMs ||
        covenant?.createdAtMs ||
        action.blockTimeMs ||
        Date.now(),
      isLatestContinuation,
    };
  }

  private getLatestCovenantOutputAction(
    actions: IndexerCovenantAction[],
  ): IndexerCovenantAction | undefined {
    return actions
      .filter(
        (action) =>
          !!action.outputs &&
          (action.action === 'continuation' || action.action === 'deploy'),
      )
      .sort((a, b) => (b.blockTimeMs || 0) - (a.blockTimeMs || 0))[0];
  }

  private extractScriptHashFromScriptPubKey(
    scriptPubKeyHex: string | undefined,
  ): string | undefined {
    const normalized = scriptPubKeyHex?.trim().toLowerCase();
    if (!normalized) return undefined;

    // P2SH covenant output: OP_0/OP_PUSHDATA-ish prefix + 32-byte script hash + suffix.
    const match = normalized.match(/^aa20([0-9a-f]{64})87$/);
    return match?.[1];
  }

  private templateForIndexerName(
    templateName: string,
  ): ContractTemplate | undefined {
    const normalized = this.normalizeTemplateName(templateName);
    if (normalized.includes('deadman')) {
      return this.templateById('dead-mans-switch');
    }
    if (normalized.includes('timelock')) {
      return this.templateById('time-lock-vault');
    }
    if (normalized.includes('multisig')) {
      return this.templateById('multi-sig-vault');
    }
    if (normalized.includes('escrow')) {
      return this.templateById('escrow-with-arbiter');
    }

    const aliases: Record<string, string> = {
      timelockvault: 'time-lock-vault',
      multisigvault: 'multi-sig-vault',
      multisig: 'multi-sig-vault',
      escrowwitharbiter: 'escrow-with-arbiter',
      escrow: 'escrow-with-arbiter',
      deadmansswitch: 'dead-mans-switch',
      deadmans: 'dead-mans-switch',
      deadman: 'dead-mans-switch',
    };
    const templateId = aliases[normalized];
    return CONTRACT_TEMPLATES.find(
      (template) =>
        template.id === templateId ||
        this.normalizeTemplateName(template.id) === normalized ||
        this.normalizeTemplateName(template.name) === normalized,
    );
  }

  private templateForIndexerArgs(
    args: IndexerCovenantArg[],
  ): ContractTemplate | undefined {
    const names = new Set(args.map((arg) => arg.name));
    if (
      names.has('owner') &&
      names.has('heir') &&
      names.has('checkInDeadline')
    ) {
      return this.templateById('dead-mans-switch');
    }
    if (
      names.has('signer') &&
      names.has('recoveryKey') &&
      names.has('unlockBlueScore')
    ) {
      return this.templateById('time-lock-vault');
    }
    if (names.has('signer1') && names.has('signer2') && names.has('signer3')) {
      return this.templateById('multi-sig-vault');
    }
    if (names.has('buyer') && names.has('seller') && names.has('arbiter')) {
      return this.templateById('escrow-with-arbiter');
    }
    return undefined;
  }

  private templateById(id: string): ContractTemplate | undefined {
    return CONTRACT_TEMPLATES.find((template) => template.id === id);
  }

  private normalizeTemplateName(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private indexerArgsToTemplateValues(
    template: ContractTemplate,
    args: IndexerCovenantArg[],
  ): Record<string, string> {
    const byName = new Map(args.map((arg) => [arg.name, String(arg.value)]));
    const requireArg = (name: string): string => {
      const value = byName.get(name);
      if (!value)
        throw new Error(
          `Indexer response is missing "${name}" for ${template.name}.`,
        );
      return value;
    };

    switch (template.id) {
      case 'time-lock-vault':
        return {
          owner: requireArg('signer'),
          recovery: requireArg('recoveryKey'),
          timeout: requireArg('unlockBlueScore'),
        };
      case 'multi-sig-vault':
        return {
          key1: requireArg('signer1'),
          key2: requireArg('signer2'),
          key3: requireArg('signer3'),
        };
      case 'escrow-with-arbiter':
        return {
          buyer: requireArg('buyer'),
          seller: requireArg('seller'),
          arbiterHash: requireArg('arbiter'),
          expiry: requireArg('timeoutBlueScore'),
        };
      case 'dead-mans-switch':
        return {
          owner: requireArg('owner'),
          heir: requireArg('heir'),
          expiry:
            byName.get('inactivityPeriodDays') ??
            byName.get('inactivityPeriod') ??
            requireArg('checkInDeadline'),
        };
      default:
        throw new Error(`Unsupported covenant template "${template.name}".`);
    }
  }

  private async compileTemplateWithFieldValues(
    template: ContractTemplate,
    fieldValues: Record<string, string>,
  ): Promise<CompiledContract> {
    const newArgs = template.fields.map((field) =>
      this.fieldToCtorArg(field, fieldValues[field.paramName]),
    );
    const compiled = await firstValueFrom(
      this.http.get<any>(template.assetPath),
    );
    const descriptor = this.templatePatcher.extractPatchDescriptor(
      compiled,
      template.placeholderArgs,
    );
    return this.templatePatcher.applyPatch(
      compiled,
      descriptor,
      newArgs,
    ) as CompiledContract;
  }

  private async extractTemplateIntField(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<bigint | undefined> {
    const template = this.templateById(templateId);
    if (!template) return undefined;

    try {
      const baseCompiled = await firstValueFrom(
        this.http.get<any>(template.assetPath),
      );
      const descriptor = this.templatePatcher.extractPatchDescriptor(
        baseCompiled,
        template.placeholderArgs,
      );
      const param = descriptor.params.find((entry) => entry.name === paramName);
      const position = param?.positions[0];
      if (!param || param.paramType !== 'int_field' || !position) {
        return undefined;
      }

      const bytes = compiled.script.slice(
        position.offset,
        position.offset + position.length,
      );
      let value = 0n;
      for (let index = 0; index < bytes.length; index += 1) {
        value += BigInt(bytes[index] & 0xff) << BigInt(index * 8);
      }
      return value;
    } catch {
      return undefined;
    }
  }

  private async extractTemplatePubkeyHex(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<string | undefined> {
    const template = this.templateById(templateId);
    if (!template) return undefined;

    try {
      const baseCompiled = await firstValueFrom(
        this.http.get<any>(template.assetPath),
      );
      const descriptor = this.templatePatcher.extractPatchDescriptor(
        baseCompiled,
        template.placeholderArgs,
      );
      const param = descriptor.params.find((entry) => entry.name === paramName);
      const position = param?.positions[0];
      if (!param || param.paramType !== 'pubkey' || !position) {
        return undefined;
      }

      return compiled.script
        .slice(position.offset, position.offset + position.length)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return undefined;
    }
  }

  /**
   * Delete a contract from registry
   */
  deleteContract(id: string) {
    this.registryService.deleteContract(id);
    this.loadContracts();
  }

  /**
   * Get param display string (for template)
   */
  getParamTypes(
    params: Array<{ name: string; type_ref: { base: string } }>,
  ): string {
    return params.map((p) => `${p.name}:${p.type_ref.base}`).join(', ');
  }

  /**
   * Get ABI param display string
   */
  getAbiInputTypes(inputs: Array<{ name: string; type_name: string }>): string {
    return inputs.map((i) => i.type_name).join(', ');
  }

  /**
   * Parse contract and extract access roles
   */
  parseAccessRoles(contract: CompiledContract): Array<{
    functionName: string;
    params: Array<{ name: string; type: string }>;
    description: string;
  }> {
    const roles: Array<{
      functionName: string;
      params: Array<{ name: string; type: string }>;
      description: string;
    }> = [];

    // Get constructor params (baked-in pubkeys)
    const constructorPubkeys = contract.ast.params
      .filter((p) => p.type_ref.base === 'pubkey')
      .map((p) => ({ name: p.name, type: 'pubkey' }));

    // Get entrypoint functions
    const entrypoints = contract.ast.functions.filter((f) => f.entrypoint);

    for (const fn of entrypoints) {
      const fnParams = fn.params.map((p) => ({
        name: p.name,
        type: p.type_ref.base,
      }));

      // Build human-readable description
      const pubkeyParams = constructorPubkeys.filter((p) =>
        fnParams.some((fp) => fp.type === 'pubkey' && fp.name === p.name),
      );

      let description = `Function "${fn.name}" can be called`;
      if (pubkeyParams.length > 0) {
        const names = pubkeyParams.map((p) => p.name).join(', ');
        description += ` by ${names}`;
      }

      roles.push({
        functionName: fn.name,
        params: fnParams,
        description,
      });
    }

    return roles;
  }

  /**
   * Deploy a contract
   */
  async deployContract() {
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);

    const wallet = this.selectedAccount();
    if (!wallet) {
      this.deployError.set('No wallet selected');
      return;
    }

    const contractJson = this.deployContractJson();
    const amountKas = Number(this.deployAmount);

    if (!contractJson) {
      this.validateDeployContractJson(true);
      return;
    }

    if (!this.validateDeployContractJson(true)) {
      return;
    }

    if (!this.validateDeployAmount(true)) {
      return;
    }

    try {
      this.isDeploying.set(true);

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const amountSompi = BigInt(Math.floor(amountKas * 1e8));

      if (
        this.currentWallet()?.getIdWithAccount() !== wallet.getIdWithAccount()
      ) {
        this.walletService.selectCurrentWallet(wallet.getIdWithAccount());
      }

      const actionResult =
        await this.walletActionService.validateAndDoActionAfterApproval({
          type: WalletActionType.COVENANT_DEPLOY,
          data: {
            compiledContractJson: contractJson,
            contractName: compiled.contract_name || 'Covenant',
            amountSompi,
          },
        });

      if (!actionResult.success || !actionResult.result) {
        this.deployError.set('Covenant deployment was rejected or failed');
        return;
      }

      const result = actionResult.result as CovenantDeployActionResult;

      // Save to registry
      const entry: ContractRegistryEntry = {
        id: this.registryService.generateId(),
        contractName: compiled.contract_name || 'Unnamed Contract',
        compiledJson: contractJson,
        deployTxid: result.txid,
        contractAddress: result.contractAddress,
        outpoint: result.outpoint,
        amountSompi: amountSompi.toString(),
        deployedBy: {
          address: wallet.getAddress(),
          pubkey: this.selectedPubkey(),
          accountName: wallet.getDisplayName(),
        },
        deployedAt: Date.now(),
        network: this.network(),
        status: 'active',
        accessRoles: this.parseAccessRoles(compiled),
        covenantId: result.covenantId,
      };

      this.deployResult.set({
        address: result.contractAddress,
        txid: result.txid,
        covenantId: result.covenantId,
      });

      try {
        this.registryService.addContract(entry);
        void this.trackDeployIndexing(result.txid, entry.id, result.covenantId);
      } catch (e) {
        console.error(
          '[Deploy] Contract deployed but failed to save to registry:',
          e,
        );
        this.deployError.set(
          `Contract deployed (txid ${result.txid}), but saving it locally failed. Record the outpoint to interact later: ${result.outpoint.txid}:${result.outpoint.vout}.`,
        );
        void this.trackDeployIndexing(
          result.txid,
          undefined,
          result.covenantId,
        );
      }
    } catch (error: any) {
      console.error('[Deploy] Failed:', error);
      this.deployError.set(error?.message || 'Failed to deploy contract');
    } finally {
      this.isDeploying.set(false);
    }
  }

  private async trackDeployIndexing(
    txid: string,
    registryEntryId?: string,
    initialCovenantId?: string,
  ) {
    this.deployIndexerState.set({
      txid,
      status: 'checking',
      covenantId: initialCovenantId,
      message: 'Waiting for the indexer to see this deployment...',
    });

    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const status =
          await this.covenantIndexerService.getTransactionSettlementStatus(
            txid,
          );
        const actions = status.actions || [];
        const indexedCovenantId =
          initialCovenantId ||
          actions.find((action) => action.covenantIdHex)?.covenantIdHex;

        if (status.indexed) {
          if (registryEntryId && indexedCovenantId) {
            this.registryService.updateContract(registryEntryId, {
              covenantId: indexedCovenantId,
            });
          }
          this.deployResult.update((current) =>
            current ? { ...current, covenantId: indexedCovenantId } : current,
          );
          this.deployIndexerState.set({
            txid,
            status: 'indexed',
            covenantId: indexedCovenantId,
            message:
              'Indexed. This contract can now be shared and tracked from My Contracts.',
          });
          await this.loadContracts();
          return;
        }

        this.deployIndexerState.set({
          txid,
          status: 'checking',
          covenantId: indexedCovenantId,
          message: `Waiting for indexer confirmation (${attempt}/8)...`,
        });
      } catch (error: any) {
        console.warn('[Contracts] Deploy indexing check failed:', error);
        this.deployIndexerState.set({
          txid,
          status: 'unavailable',
          covenantId: initialCovenantId,
          message:
            error?.message ||
            'Indexer status is unavailable. The deployment tx was still returned by the wallet.',
        });
        return;
      }

      await this.delay(2500);
    }

    this.deployIndexerState.set({
      txid,
      status: 'not-indexed',
      covenantId: initialCovenantId,
      message:
        'Deployment broadcasted, but the indexer has not confirmed it yet. Refresh My Contracts in a moment.',
    });
  }

  onInteractContractSelect(value: any) {
    this.selectedContractId.set(value || '');
    this.selectContractFromRegistry();
  }

  /**
   * Select a contract from registry for interaction
   */
  selectContractFromRegistry() {
    // Look up the selected entry from the loaded registry list.
    const contract = this.registryContracts().find(
      (c) => c.id === this.selectedContractId(),
    );
    if (contract) {
      this.interactContractJson.set(contract.compiledJson);
      this.interactOutpointTxid = contract.outpoint.txid;
      this.interactOutpointVout = contract.outpoint.vout.toString();
      this.interactInputAmount = contract.amountSompi;
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
      this.interactResolvedOutputAddress = null;
    }
  }

  /**
   * Interact with a contract
   */
  async interactContract() {
    this.interactError.set(null);
    this.interactResult.set(null);

    const wallet = this.currentWallet();
    if (!wallet) {
      this.interactError.set('No wallet connected');
      return;
    }

    const contractJson = this.interactContractJson();
    const txid = this.interactOutpointTxid;
    const vout = parseInt(this.interactOutpointVout, 10);
    const inputAmountSompi = this.interactInputAmount;
    const functionName = this.selectedFunction;
    let outputAddress =
      this.interactResolvedOutputAddress || this.interactOutputAddress;
    const outputAmountKas = parseFloat(this.interactOutputAmount);
    const topUpAmountKas = parseFloat(this.topUpAmount);

    if (!contractJson) {
      this.interactError.set('Contract JSON is required');
      return;
    }

    if (!txid || isNaN(vout)) {
      this.interactError.set('Valid outpoint (txid and vout) is required');
      return;
    }

    if (!inputAmountSompi || BigInt(inputAmountSompi) <= 0n) {
      this.interactError.set('Input amount (sompi) is required');
      return;
    }

    if (!functionName) {
      this.interactError.set('Please select an entrypoint function');
      return;
    }

    // TODO(covenant): changeHeir is a UI stub — see isChangeHeirFunction() for why
    // there's no on-chain call to make yet.
    if (this.isChangeHeirFunction(functionName)) {
      this.interactError.set(
        "Change Heir isn't available yet — it requires a Dead Man's Switch contract update to support changing the heir after deployment. Check with the team for status.",
      );
      return;
    }

    try {
      this.isInteracting.set(true);

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const outpoint: CovenantOutpoint = { txid: txid.trim(), vout };
      const inputAmount = BigInt(inputAmountSompi);
      const privateKey = wallet.getPrivateKey().toString();

      // Build outputs based on function type
      let outputs: SpendOutput[];
      let extraArgsOverride: Record<string, bigint> | undefined;
      let useSenderFeeOverride: boolean | undefined;

      if (this.isTopUpFunction(functionName)) {
        if (isNaN(topUpAmountKas) || topUpAmountKas <= 0) {
          this.interactError.set('Top-up amount must be greater than 0');
          return;
        }

        const covenantId = this.selectedContract()?.covenantId;
        if (!covenantId) {
          this.interactError.set(
            'Cannot top up this contract until its covenant ID is known. Refresh/import it from the indexer first.',
          );
          return;
        }

        const topUpAmount = BigInt(Math.floor(topUpAmountKas * 1e8));
        if (topUpAmount <= 0n) {
          this.interactError.set(
            'Top-up amount must be at least 0.00000001 KAS',
          );
          return;
        }

        outputs = [
          {
            address: this.covenantService.getContractAddress(compiled),
            amount: inputAmount + topUpAmount,
            covenantId,
          },
        ];
      } else if (
        functionName === 'arbitrate' &&
        compiled.contract_name === 'Escrow'
      ) {
        // Escrow arbitrate: the "Withdraw Amount (KAS)" field is reused as amountToSeller.
        if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
          this.interactError.set(
            'Enter the amount to send to the seller in the "Withdraw Amount" field',
          );
          return;
        }
        const amountToSellerSompi = BigInt(Math.floor(outputAmountKas * 1e8));
        const amountToBuyerSompi =
          inputAmount > amountToSellerSompi
            ? inputAmount - amountToSellerSompi
            : 0n;

        // Derive seller/buyer addresses from pubkeys baked into the compiled script.
        // Escrow constructor order: buyer (param 0), seller (param 1).
        const pubkeys = this.extractPubkeysFromScript(compiled);
        const buyerAddress = pubkeys[0] ? this.pubkeyToAddress(pubkeys[0]) : '';
        const sellerAddress = pubkeys[1]
          ? this.pubkeyToAddress(pubkeys[1])
          : '';

        if (!sellerAddress || !buyerAddress) {
          this.interactError.set(
            'Could not derive buyer/seller addresses from contract script',
          );
          return;
        }

        outputs = [
          { address: sellerAddress, amount: amountToSellerSompi },
          { address: buyerAddress, amount: amountToBuyerSompi },
        ];
        extraArgsOverride = { amountToSeller: amountToSellerSompi };

        if (!this.isMultiSigFunction(functionName)) {
          const result = await this.runCovenantSpendAction(
            compiled,
            contractJson,
            outpoint,
            inputAmount,
            functionName,
            outputs,
            extraArgsOverride,
            undefined,
            this.useSenderFee,
          );
          if (!result) return;
          this.interactResult.set({
            txid: result.txid,
            functionName: result.functionName,
          });
          if (this.selectedContractId()) {
            this.registryService.updateContract(this.selectedContractId(), {
              status: 'spent',
              spendTxid: result.txid,
              lastChecked: Date.now(),
            });
            this.loadContracts();
          }
          return;
        }
      } else if (this.functionRequiresOutput(functionName)) {
        // Withdrawal function — validate user-provided output
        if (!outputAddress) {
          this.interactError.set('Output address is required');
          return;
        }
        if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
          this.interactError.set('Output amount must be greater than 0');
          return;
        }
        const withdrawalAmount = BigInt(Math.floor(outputAmountKas * 1e8));
        if (
          compiled.contract_name === 'DeadManSwitch' &&
          functionName === 'withdraw'
        ) {
          if (withdrawalAmount >= inputAmount) {
            this.interactError.set(
              "Dead Man's Switch withdraw must leave a continuation in the contract. Use claim after the deadline for the heir path.",
            );
            return;
          }
          const owner =
            (await this.extractTemplatePubkeyHex(
              compiled,
              'dead-mans-switch',
              'owner',
            )) || this.extractPubkeysFromScript(compiled)[0];
          const ownerAddress = owner ? this.pubkeyToAddress(owner) : '';
          if (!ownerAddress) {
            this.interactError.set(
              'Could not derive owner address from contract script',
            );
            return;
          }
          outputAddress = ownerAddress;
          extraArgsOverride = { amount: withdrawalAmount };
          useSenderFeeOverride = true;
        }
        const withdrawalOutputs = this.buildWithdrawalOutputs(
          compiled,
          inputAmount,
          outputAddress,
          withdrawalAmount,
        );
        if (!withdrawalOutputs) return;
        outputs = withdrawalOutputs;
      } else if (this.isDmsKeepAlive()) {
        // DMS keepAlive — delegate to the dedicated method which handles new-contract generation
        await this.executeDmsKeepAlive(
          compiled,
          contractJson,
          outpoint,
          inputAmount,
        );
        return;
      } else {
        // Redeploy function (keepAlive, increment) — send full balance minus fee back to covenant
        // We set it to full amount and the SDK will deduct the actual network fee from the output if useSenderFee is false
        const covenantAddress =
          this.covenantService.getContractAddress(compiled);
        const redeployAmount = inputAmount;
        outputs = [
          {
            address: covenantAddress,
            amount: redeployAmount,
          },
        ];
      }

      // Collect extra args (int, bool params like escrow arbitrate's amountToSeller)
      const extraArgs =
        extraArgsOverride || this.collectExtraArgs(compiled, functionName);

      // Multi-sig functions: build partial spend instead of broadcasting
      if (this.isMultiSigFunction(functionName)) {
        const approvalResult =
          await this.walletActionService.validateAndApproveAction({
            type: WalletActionType.COVENANT_SPEND,
            data: {
              compiledContractJson: contractJson,
              contractName: compiled.contract_name || 'Covenant',
              outpoint,
              inputAmountSompi: inputAmount,
              functionName,
              outputs,
              extraArgs:
                Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
              useSenderFee: false,
            },
          });

        if (
          !approvalResult.isApproved ||
          approvalResult.priorityFee === undefined
        ) {
          this.interactError.set(
            'Covenant partial signing was rejected or failed',
          );
          return;
        }

        const partial = await this.covenantService.buildPartial(
          compiled,
          functionName,
          outpoint,
          inputAmount,
          outputs,
          privateKey,
          approvalResult.priorityFee,
          extraArgs,
        );
        const partialJson = JSON.stringify(partial, null, 2);
        this.partialSpendJson.set(partialJson);
        this.flowPagesService.saveTransientState('contracts', {
          activeTab: 'interact',
          selectedFunction: functionName,
          interactContractJson: contractJson,
          interactOutpointTxid: this.interactOutpointTxid,
          interactOutpointVout: this.interactOutpointVout,
          interactInputAmount: this.interactInputAmount,
          interactOutputAddress: this.interactOutputAddress,
          interactOutputAmount: this.interactOutputAmount,
          topUpAmount: this.topUpAmount,
          partialSpendJson: partialJson,
          interactResult: {
            txid: '(partial - share with co-signer)',
            functionName,
          },
        } satisfies ContractsTransientState);
        this.approvalFlowService.closeApproval();
        navigator.clipboard.writeText(partialJson).then(
          () => {},
          () => {}, // Clipboard may not be available
        );
        this.interactResult.set({
          txid: '(partial — share with co-signer)',
          functionName,
        });
        return;
      }

      const result = await this.runCovenantSpendAction(
        compiled,
        contractJson,
        outpoint,
        inputAmount,
        functionName,
        outputs,
        Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
        undefined,
        useSenderFeeOverride ?? this.useSenderFee,
      );
      if (!result) return;

      this.interactResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Update registry based on function type
      if (this.selectedContractId()) {
        if (this.isTopUpFunction(functionName)) {
          this.registryService.updateContract(this.selectedContractId(), {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: 0 },
            amountSompi: outputs[0].amount.toString(),
            covenantId:
              this.selectedContract()?.covenantId || result.covenantId,
          });
          this.interactOutpointTxid = result.txid;
          this.interactOutpointVout = '0';
          this.interactInputAmount = outputs[0].amount.toString();
          this.topUpAmount = '';
        } else if (this.functionRequiresOutput(functionName)) {
          const covenantAddress =
            this.covenantService.getContractAddress(compiled);
          const continuationOutputIndex = outputs.findIndex(
            (output) => output.address === covenantAddress,
          );
          if (continuationOutputIndex >= 0) {
            const continuationAmount = outputs[continuationOutputIndex].amount;
            this.registryService.updateContract(this.selectedContractId(), {
              lastChecked: Date.now(),
              outpoint: { txid: result.txid, vout: continuationOutputIndex },
              amountSompi: continuationAmount.toString(),
            });
            this.interactOutpointTxid = result.txid;
            this.interactOutpointVout = continuationOutputIndex.toString();
            this.interactInputAmount = continuationAmount.toString();
          } else {
            // Full withdrawal: funds left the covenant
            this.registryService.updateContract(this.selectedContractId(), {
              status: 'spent',
              spendTxid: result.txid,
              lastChecked: Date.now(),
            });
          }
        } else {
          // Redeploy (keepAlive/increment): update the outpoint to the new UTXO
          this.registryService.updateContract(this.selectedContractId(), {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: 0 },
            amountSompi: inputAmount.toString(), // The registry doesn't accurately know the post-fee amount until refreshed, but setting inputAmount is close enough
          });
          // Update the interact form with the new outpoint
          this.interactOutpointTxid = result.txid;
          this.interactOutpointVout = '0';
        }
        this.loadContracts();
      }
    } catch (error: any) {
      this.interactError.set(error?.message || 'Failed to execute contract');
    } finally {
      this.isInteracting.set(false);
    }
  }

  private buildWithdrawalOutputs(
    compiled: CompiledContract,
    inputAmount: bigint,
    outputAddress: string,
    withdrawalAmount: bigint,
  ): SpendOutput[] | undefined {
    if (withdrawalAmount > inputAmount) {
      this.interactError.set(
        'Withdraw amount cannot exceed the contract balance',
      );
      return undefined;
    }

    const remainder = inputAmount - withdrawalAmount;
    const outputs: SpendOutput[] = [
      {
        address: outputAddress,
        amount: withdrawalAmount,
      },
    ];

    if (remainder === 0n) {
      return outputs;
    }

    if (remainder < this.MIN_CONTINUATION_AMOUNT_SOMPI) {
      this.interactError.set(
        'Partial withdrawals must leave at least 0.5 KAS in the contract. Withdraw the full amount or reduce the withdrawal.',
      );
      return undefined;
    }

    outputs.push({
      address: this.covenantService.getContractAddress(compiled),
      amount: remainder,
      covenantId: this.selectedContract()?.covenantId,
    });

    return outputs;
  }

  /**
   * Execute a Dead Man's Switch keepAlive:
   *   1. Validates the new expiry input.
   *   2. Extracts owner + heir pubkeys from the current compiled script.
   *   3. Generates a new DMS compiled JSON with the same owner/heir but new expiry.
   *   4. Spends the old DMS UTXO via keepAlive, sending funds to the new DMS address.
   *      The existing covenantId is attached via CovenantBinding to preserve lineage.
   *   5. Marks old registry entry as spent, registers a new entry for the continuation.
   */
  private async executeDmsKeepAlive(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmount: bigint,
  ): Promise<void> {
    this.dmsKeepAliveError.set(null);

    const oldEntry = this.registryContracts().find(
      (c) => c.id === this.selectedContractId(),
    );
    const oldCovenantId = oldEntry?.covenantId;
    const keepAliveAbi = compiled.abi.find(
      (entry) => entry.name === 'keepAlive',
    );
    const supportsDeadlineKeepAlive =
      keepAliveAbi?.inputs.some((input) => input.name === 'newDeadline') &&
      (compiled.ast as any)?.fields?.some(
        (field: any) => field.name === 'deadline',
      );
    if (!supportsDeadlineKeepAlive) {
      this.dmsKeepAliveError.set(
        "This Dead Man's Switch was deployed with the old inactivity-period contract. It cannot be migrated to the new deadline contract with keepAlive; deploy a new deadline-based Dead Man's Switch.",
      );
      return;
    }

    if (!this.dmsNewExpiry.trim()) {
      this.dmsKeepAliveError.set('Select the new check-in deadline');
      return;
    }

    const newDeadline = BigInt(
      this.parseDateToUnixMs(this.dmsNewExpiry, 'New check-in deadline'),
    );
    const currentDeadline = await this.extractTemplateIntField(
      compiled,
      'dead-mans-switch',
      'initDeadline',
    );
    if (currentDeadline !== undefined && newDeadline <= currentDeadline) {
      this.dmsKeepAliveError.set(
        `New check-in deadline must be later than the current deadline (${this.formatTimestamp(Number(currentDeadline))}).`,
      );
      return;
    }
    const fallbackPubkeys = this.extractPubkeysFromScript(compiled);
    const owner =
      (await this.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'owner',
      )) || fallbackPubkeys[0];
    const heir =
      (await this.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'heir',
      )) || fallbackPubkeys[1];
    const ownerAddress = owner ? this.pubkeyToAddress(owner) : '';
    const heirAddress = heir ? this.pubkeyToAddress(heir) : '';
    if (!ownerAddress || !heirAddress) {
      this.dmsKeepAliveError.set(
        'Could not derive owner/heir addresses from contract script',
      );
      return;
    }

    const template = this.templateById('dead-mans-switch');
    if (!template) {
      this.dmsKeepAliveError.set("Dead Man's Switch template is unavailable");
      return;
    }

    const nextCompiled = await this.compileTemplateWithFieldValues(template, {
      owner: ownerAddress,
      heir: heirAddress,
      expiry: this.dmsNewExpiry,
    });
    const nextContractJson = JSON.stringify(nextCompiled, null, 2);
    const nextContractAddress =
      this.covenantService.getContractAddress(nextCompiled);

    // Build spend output: full amount → new DMS address, with CovenantBinding if we have a covenantId
    const spendOutputs: SpendOutput[] = [
      {
        address: nextContractAddress,
        amount: inputAmount,
        covenantId: oldCovenantId, // attach binding to preserve lineage
      },
    ];

    // 5. Execute the keepAlive spend on the old contract
    const result = await this.runCovenantSpendAction(
      compiled,
      contractJson,
      outpoint,
      inputAmount,
      'keepAlive',
      spendOutputs,
      { newDeadline },
      oldCovenantId,
      true,
    );
    if (!result) return;

    this.interactResult.set({ txid: result.txid, functionName: 'keepAlive' });

    if (this.selectedContractId()) {
      this.registryService.updateContract(this.selectedContractId(), {
        status: 'active',
        compiledJson: nextContractJson,
        contractAddress: nextContractAddress,
        accessRoles: this.parseAccessRoles(nextCompiled),
        outpoint: { txid: result.txid, vout: 0 },
        amountSompi: inputAmount.toString(),
        lastChecked: Date.now(),
      });
    }
    this.interactContractJson.set(nextContractJson);
    this.interactOutpointTxid = result.txid;
    this.interactOutpointVout = '0';
    this.interactInputAmount = inputAmount.toString();
    this.dmsNewExpiry = '';

    this.loadContracts();
  }

  /** Convert a hex string to Uint8Array */
  private hexStringToBytes(hex: string): Uint8Array {
    const normalized = hex.replace(/^0x/i, '');
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }
    return bytes;
  }

  private async runCovenantSpendAction(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmountSompi: bigint,
    functionName: string,
    outputs: SpendOutput[],
    extraArgs?: Record<string, bigint>,
    covenantId?: string,
    useSenderFee = false,
    transactionPayloadHex?: string,
  ): Promise<CovenantSpendActionResult | undefined> {
    const actionResult =
      await this.walletActionService.validateAndDoActionAfterApproval({
        type: WalletActionType.COVENANT_SPEND,
        data: {
          compiledContractJson: contractJson,
          contractName: compiled.contract_name || 'Covenant',
          outpoint,
          inputAmountSompi,
          functionName,
          outputs,
          extraArgs,
          covenantId,
          useSenderFee,
          transactionPayloadHex,
        },
      });

    if (!actionResult.success || !actionResult.result) {
      this.interactError.set('Covenant interaction was rejected or failed');
      return undefined;
    }

    return actionResult.result as CovenantSpendActionResult;
  }

  /**
   * Check if current account can call a function
   */
  canCallFunction(
    contract: ContractRegistryEntry,
    functionName: string,
  ): boolean {
    const currentPubkey = this.currentWallet()
      ?.getPrivateKey()
      .toPublicKey()
      .toXOnlyPublicKey()
      .toString();
    if (!currentPubkey) return false;

    // Check if the function requires a specific pubkey that matches the current account
    const role = contract.accessRoles.find(
      (r) => r.functionName === functionName,
    );
    if (!role) return false;

    // If function has pubkey params, check if any constructor param matches current pubkey
    const hasPubkeyParam = role.params.some((p) => p.type === 'pubkey');
    if (!hasPubkeyParam) return true; // No pubkey requirement, anyone can call

    // Parse contract to get constructor param values (need to check the actual baked-in values)
    // For now, we'll check if deployed by current account as a simple heuristic
    return contract.deployedBy.pubkey === currentPubkey;
  }

  onLookupAddressChange(value: any) {
    this.lookupAddress = value || '';
  }

  /**
   * Look up a contract address on-chain — fetch its UTXOs and balance
   */
  async lookupContract() {
    const address = this.lookupAddress.trim();
    if (!address) return;

    this.lookupLoading.set(true);
    this.lookupError.set(null);
    this.lookupResult.set(null);

    try {
      const rpc = this.rpcService.getRpc();
      if (!rpc) {
        throw new Error('RPC not available — wallet may not be connected');
      }

      console.log('[Lookup] Querying UTXOs for', address);
      const utxoResponse = await rpc.getUtxosByAddresses([address]);
      const entries = utxoResponse.entries || [];

      let totalSompi = BigInt(0);
      const utxos: Array<{ txid: string; vout: number; amount: string }> = [];

      for (const entry of entries) {
        const amount = entry.amount;
        totalSompi += amount;
        utxos.push({
          txid: entry.outpoint?.transactionId || '',
          vout: Number(entry.outpoint?.index ?? 0),
          amount: amount.toString(),
        });
      }

      this.lookupResult.set({
        address,
        balanceSompi: totalSompi.toString(),
        utxoCount: utxos.length,
        utxos,
      });

      console.log(
        '[Lookup] Found',
        utxos.length,
        'UTXOs, total:',
        totalSompi.toString(),
        'sompi',
      );
    } catch (err: any) {
      console.error('[Lookup] Failed:', err);
      this.lookupError.set(err?.message || 'Failed to query contract address');
    } finally {
      this.lookupLoading.set(false);
    }
  }

  /**
   * Import a looked-up contract into the registry (with compiled JSON)
   */
  importLookupContract() {
    const result = this.lookupResult();
    if (!result || result.utxos.length === 0) return;
    if (!this.lookupContractJson) return;

    // Switch to interact tab with UTXO + contract JSON pre-filled
    this.interactContractJson.set(this.lookupContractJson);
    this.interactOutpointTxid = result.utxos[0].txid;
    this.interactOutpointVout = String(result.utxos[0].vout);
    this.interactInputAmount = result.utxos[0].amount;
    this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
    this.switchTab('interact');
  }

  /**
   * Get explorer link for address
   */
  getExplorerAddressLink(address: string): string {
    return `${this.kaspaL1NetworkService.getKaspaExplorerBaseurl()}/addresses/${address}`;
  }

  /**
   * Get explorer link for transaction
   */
  getExplorerLink(txid: string): string {
    return `${this.kaspaL1NetworkService.getKaspaExplorerBaseurl()}/txs/${txid}`;
  }

  /**
   * Truncate string for display
   */
  truncate(str: string, length: number = 16): string {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...' + str.substring(str.length - 6);
  }

  /**
   * Format sompi to KAS
   */
  formatSompiToKas(sompi: string): string {
    try {
      const kas = Number(BigInt(String(sompi || '0'))) / 1e8;
      return kas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  }

  getSourceLabel(contract: ContractDashboardEntry): string {
    return this.getSourceLabels(contract).join(' + ');
  }

  getSourceLabels(contract: ContractDashboardEntry): string[] {
    if (contract.source === 'both') return ['Local', 'Indexer'];
    return [contract.source === 'indexer' ? 'Indexer' : 'Local'];
  }

  getStatusLabel(contract: ContractDashboardEntry): string {
    const labels: Record<ContractDashboardEntry['status'], string> = {
      active: 'Active',
      spent: 'Spent',
      unknown: 'Unknown',
      'tracking-incomplete': 'Tracking incomplete',
    };
    return labels[contract.status] || 'Unknown';
  }

  formatTimestamp(value: number | undefined | null): string {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  }

  formatActionName(action: string): string {
    const labels: Record<string, string> = {
      deploy: 'Deploy',
      spend: 'Spend',
      continuation: 'Continuation',
      keepAlive: 'Keep Alive',
      claim: 'Claim',
      spend12: 'MultiSig Spend',
      release: 'Release',
      refund: 'Refund',
      arbitrate: 'Arbitrate',
      recover: 'Recover',
      withdraw: 'Withdraw',
    };
    return labels[action] || action;
  }

  /**
   * Builds a share link that carries only the network and canonical covenant
   * ID — never private data or compiled JSON. The receiving wallet imports
   * current state from the indexer when the link is opened.
   */
  buildShareLink(covenantId: string): string {
    const url = new URL(`${window.location.origin}/app/contracts/${covenantId}`);
    url.searchParams.set('network', this.network());
    return url.toString();
  }

  copyContractShareLink(contract: ContractDashboardEntry) {
    const id = contract.covenantId;
    if (!id) return;
    const link = this.buildShareLink(id);
    navigator.clipboard.writeText(link).then(
      () => alert('Contract share link copied.'),
      () => prompt('Copy this contract link:', link),
    );
  }

  copyDeployedContractShareLink() {
    const id =
      this.deployIndexerState()?.covenantId || this.deployResult()?.covenantId;
    if (!id) return;
    const link = this.buildShareLink(id);
    navigator.clipboard.writeText(link).then(
      () => alert('Contract share link copied.'),
      () => prompt('Copy this contract link:', link),
    );
  }

  /** Contract explicitly picked in the "Share a contract" card; empty = auto-default to most recent. */
  shareableContractId = signal<string>('');

  /** Dropdown options for the "Share a contract" card — only contracts with a covenant ID can be shared. */
  shareableContracts = computed<ContractDashboardEntry[]>(() =>
    this.dashboardContracts().filter((c) => !!c.covenantId),
  );

  /** Effective selection — the explicit pick, or the most-recently-interacted contract. */
  effectiveShareableContractId = computed<string>(
    () => this.shareableContractId() || this.shareableContracts()[0]?.id || '',
  );

  /** Dropdown options for the "Share a contract" card. */
  shareableContractOptions = computed<DropdownOption[]>(() =>
    this.shareableContracts().map((contract) => ({
      value: contract.id,
      label: contract.displayName,
    })),
  );

  /** Readonly link shown in the "Share a contract" card. */
  shareableContractLink = computed<string>(() => {
    const id = this.effectiveShareableContractId();
    if (!id) return '';
    const contract = this.shareableContracts().find((c) => c.id === id);
    if (!contract?.covenantId) return '';
    return this.buildShareLink(contract.covenantId);
  });

  onShareableContractChange(value: string) {
    this.shareableContractId.set(value || '');
  }

  copyShareableContractLink() {
    const link = this.shareableContractLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => alert('Contract share link copied.'),
      () => prompt('Copy this contract link:', link),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private fieldToCtorArg(
    field: TemplateField,
    rawValue: string | number | undefined,
  ): CtorArg {
    const value = String(rawValue ?? '').trim();
    if (!value) {
      throw new Error(`${field.label} is required`);
    }

    switch (field.type) {
      case 'address':
        return this.bytesArg(
          this.templatePatcher.kaspaAddressToPubkeyBytes(value),
        );
      case 'hash32':
        return this.bytesArg(this.parseHash32(value, field.label));
      case 'int_days': {
        // this.age in SilverScript = DAA score difference (virtual blue score)
        // On mainnet (1 BPS): DAA ≈ 1/sec → 86,400/day (days * 86400 is correct)
        // Max ~194 days (3-byte encoding limit: 16,777,215 / 86400 ≈ 194)
        const days = this.parseWholeNumber(value, field.label);
        if (days > 194) {
          throw new Error(
            `${field.label}: maximum is 194 days (template encoding limit)`,
          );
        }
        return this.intArg(days * 86400);
      }
      case 'int_count':
        return this.intArg(this.parseWholeNumber(value, field.label));
      case 'int_timestamp':
        return this.intArg(this.parseDateToUnixMs(value, field.label));
      default:
        throw new Error(
          `Unsupported template field type: ${(field as { type: string }).type}`,
        );
    }
  }

  private parseHash32(value: string, label: string): number[] {
    const normalized = value.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error(`${label} must be a 32-byte hex string`);
    }

    const bytes: number[] = [];
    for (let index = 0; index < normalized.length; index += 2) {
      bytes.push(Number.parseInt(normalized.slice(index, index + 2), 16));
    }
    return bytes;
  }

  private parseWholeNumber(value: string, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative whole number`);
    }
    return parsed;
  }

  private parseDateToUnixMs(value: string, label: string): number {
    // Kaspa LOCK_TIME_THRESHOLD = 500,000,000,000:
    //   values < 500B → DAA score, values >= 500B → Unix milliseconds
    // We convert user input (seconds) to milliseconds to stay above the threshold.
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      if (asNumber >= 500_000_000_000) {
        // Already in milliseconds
        return Math.floor(asNumber);
      }
      if (asNumber > 946684800) {
        // Unix seconds → convert to milliseconds
        return Math.floor(asNumber * 1000);
      }
    }

    // Fallback: try parsing as date string
    const timestampMs = new Date(value).getTime();
    if (!Number.isFinite(timestampMs)) {
      throw new Error(`${label} must be a valid date and time.`);
    }

    return timestampMs;
  }

  private bytesArg(bytes: number[]): CtorArg {
    return {
      kind: 'array',
      data: bytes.map((byte) => ({ kind: 'byte' as const, data: byte })),
    };
  }

  private intArg(value: number): CtorArg {
    return {
      kind: 'int',
      data: value,
    };
  }

  // ─── Interact Tab Helpers ──────────────────────────────────────────

  /**
   * Computed input amount in KAS for display
   */
  interactInputAmountKas = computed(() => {
    const sompi = this.interactInputAmount;
    if (!sompi) return '0';
    try {
      const kas = Number(BigInt(sompi)) / 1e8;
      return kas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  });

  // ─── Function categorization ──────────────────────────────────────
  /** Functions that do NOT produce an external withdrawal output */
  private readonly REDEPLOY_FUNCTIONS = new Set(['keepAlive', 'increment']);

  isTopUpFunction(fnName: string): boolean {
    return fnName === 'topUp';
  }

  /**
   * TODO(covenant): changeHeir is UI-only for now. The DMS contract bakes `heir`
   * into the constructor script bytes rather than tracking it as covenant state
   * (unlike `deadline`, which keepAlive threads through validateOutputState), so
   * there is no on-chain entrypoint to call yet. Wire this up once the DMS
   * SilverScript template adds a real changeHeir entrypoint (or a heir-changing
   * redeploy path is agreed) — see the early return in interactContract().
   */
  isChangeHeirFunction(fnName: string): boolean {
    return fnName === 'changeHeir';
  }

  /**
   * Returns true when the current function is DMS keepAlive (requires special handling).
   * DMS keepAlive must produce output to a *new* DMS contract (with updated expiry),
   * not to the same contract address.
   */
  isDmsKeepAlive(): boolean {
    const contract = this.parsedInteractContract();
    if (!contract || this.selectedFunction !== 'keepAlive') return false;
    return (contract.contract_name || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .includes('deadman');
  }

  /**
   * Check if the selected function requires multiple signers (two-phase signing)
   */
  isMultiSigFunction(fnName: string): boolean {
    const contract = this.parsedInteractContract();
    if (!contract) return false;
    const abiEntry = contract.abi.find((e) => e.name === fnName);
    if (!abiEntry) return false;
    return abiEntry.inputs.filter((i) => i.type_name === 'sig').length > 1;
  }

  /**
   * Whether the selected function requires user-visible output address/amount fields.
   * keepAlive re-deploys to the covenant itself; increment updates on-chain state.
   */
  functionRequiresOutput(fnName: string): boolean {
    return (
      !!fnName &&
      !this.REDEPLOY_FUNCTIONS.has(fnName) &&
      !this.isTopUpFunction(fnName) &&
      !this.isChangeHeirFunction(fnName)
    );
  }

  /**
   * Select an entrypoint function — clears stale state and auto-fills
   * output fields based on the function type.
   */
  selectFunction(name: string) {
    this.selectedFunction = name;
    this.useSenderFee = !this.isMultiSigFunction(name);

    // Clear stale interaction state
    this.interactError.set(null);
    this.interactResult.set(null);
    this.partialSpendJson.set(null);
    this.extraArgValues = {};
    this.dmsNewExpiry = '';
    this.topUpAmount = '';
    this.newHeirAddress = '';
    this.newHeirResolvedAddress = null;
    this.dmsKeepAliveError.set(null);

    if (this.isTopUpFunction(name) || this.isChangeHeirFunction(name)) {
      this.interactOutputAddress = '';
      this.interactOutputAmount = '';
    } else if (this.functionRequiresOutput(name)) {
      // Withdrawal function: default output to user's wallet, clear amount
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
      this.interactOutputAmount = '';
    } else if (this.isDmsKeepAlive()) {
      // DMS keepAlive — output address will be the new DMS contract, computed later
      this.interactOutputAddress = '';
      this.interactOutputAmount = '';
    } else {
      // Redeploy function (keepAlive on other contracts, increment): auto-fill covenant address + correct amount
      const contract = this.parsedInteractContract();
      if (contract) {
        this.interactOutputAddress =
          this.covenantService.getContractAddress(contract);
      }
      const inputSompi = this.interactInputAmount;
      if (inputSompi) {
        try {
          const outputSompi = BigInt(inputSompi);
          const outputKas = Number(outputSompi) / 1e8;
          this.interactOutputAmount = outputKas
            .toFixed(8)
            .replace(/\.?0+$/, '');
        } catch {
          /* ignore */
        }
      }
    }
  }

  /**
   * Get human-readable label for a function
   */
  getFunctionLabel(name: string): string {
    const labels: Record<string, string> = {
      spend: 'Withdraw',
      withdraw: 'Withdraw',
      recover: 'Recovery Withdraw',
      claim: 'Claim',
      release: 'Release',
      refund: 'Refund',
      increment: 'Increment',
      keepAlive: 'Keep Alive',
      execute: 'Execute',
      topUp: 'Top Up',
      changeHeir: 'Change Heir',
    };
    return labels[name] || name;
  }

  /**
   * Get human-readable description for a function, contextual to the contract type.
   */
  getFunctionDescription(name: string): string {
    const contract = this.parsedInteractContract();
    const contractName = (contract?.contract_name || '').toLowerCase();

    // Contract-type-specific descriptions
    const contextual: Record<string, Record<string, string>> = {
      timelockvault: {
        spend: 'Withdraw your locked funds immediately using the owner key.',
        recover:
          'Emergency recovery using the backup key. Only available after the timelock expires.',
      },
      deadmanswitch: {
        keepAlive:
          "Prove you're still active. Re-deploys the contract with a fresh expiry — no withdrawal needed.",
        withdraw:
          'Withdraw part of the locked funds using the owner key. Must leave at least 0.5 KAS behind as a continuation.',
        claim:
          'Claim the inheritance. Only available if the owner missed their keepAlive deadline.',
        changeHeir:
          'Change the beneficiary who can claim the funds if you miss the deadline. Not available yet — this requires a Dead Man\'s Switch contract update.',
      },
      escrow: {
        release:
          'Both buyer and seller agree to release funds to the recipient.',
        refund:
          'Cancel the escrow and return funds to the sender. May require timelock expiry.',
      },
      multisigvault: {
        spend12:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from two key holders.',
      },
      counter: {
        increment:
          'Increment the on-chain counter. The contract is re-deployed with the updated state.',
      },
      kcc20: {
        transfer:
          'Transfer KCC20 tokens to another user. Enter the recipient Kaspa address and the token amount to send. Both UTXOs remain locked in the covenant.',
      },
    };

    // Try contract-specific description first
    const normalized = contractName.replace(/[\s_-]/g, '');
    for (const [key, descs] of Object.entries(contextual)) {
      if (normalized.includes(key.toLowerCase())) {
        if (descs[name]) return descs[name];
      }
    }

    // Fallback generic descriptions
    const fallback: Record<string, string> = {
      spend:
        'Withdraw funds using the owner key. Available immediately — no timelock.',
      recover:
        'Emergency withdrawal using the recovery key. Only available after the timelock expires.',
      claim: 'Claim the funds locked in this contract.',
      release: 'Release the locked funds to the designated recipient.',
      refund: 'Return the locked funds to the original sender.',
      increment:
        'Update the on-chain state. The contract is re-deployed with new values.',
      keepAlive:
        'Re-deploy the contract with a refreshed timer. No funds are withdrawn.',
      execute: "Execute this contract's logic.",
      topUp:
        'Add KAS to this covenant by spending the current covenant UTXO and recreating it with the same covenant ID.',
    };

    return fallback[name] || `Call the "${name}" function on this contract.`;
  }

  /**
   * Fill output amount with max (input amount minus estimated fee)
   */
  fillMaxOutputAmount() {
    const sompi = this.interactInputAmount;
    if (!sompi) return;
    try {
      const inputSompi = BigInt(sompi);
      const outputKas = Number(inputSompi) / 1e8;
      this.interactOutputAmount = outputKas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      // Invalid amount
    }
  }

  onInteractOutputAddressChange(value: string) {
    this.interactOutputAddress = value || '';
    this.interactResolvedOutputAddress = null;
    this.interactError.set(null);
  }

  onInteractOutputAddressResolved(result: any) {
    if (result?.effectiveAddress) {
      this.interactResolvedOutputAddress = result.effectiveAddress;
    } else {
      this.interactResolvedOutputAddress = null;
    }
  }

  onInteractOutputQrClick() {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
      return;
    }

    this.qrScannerService.startScanning({
      scannerId: 'qr-scanner-covenant-interact-output',
      title: 'Scan recipient address',
      onSuccess: (address: string) =>
        this.onInteractOutputAddressChange(address),
      onError: (error: string) =>
        console.error('[Contracts] QR scanning error:', error),
    });
  }

  onNewHeirAddressChange(value: string) {
    this.newHeirAddress = value || '';
    this.newHeirResolvedAddress = null;
    this.interactError.set(null);
  }

  onNewHeirAddressResolved(result: any) {
    if (result?.effectiveAddress) {
      this.newHeirResolvedAddress = result.effectiveAddress;
    } else {
      this.newHeirResolvedAddress = null;
    }
  }

  onNewHeirQrClick() {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
      return;
    }

    this.qrScannerService.startScanning({
      scannerId: 'qr-scanner-covenant-change-heir',
      title: 'Scan new heir address',
      onSuccess: (address: string) => this.onNewHeirAddressChange(address),
      onError: (error: string) =>
        console.error('[Contracts] QR scanning error:', error),
    });
  }

  onInteractOutputAmountChange(value: any) {
    this.interactOutputAmount =
      value === null || value === undefined ? '' : String(value);
    this.interactError.set(null);
  }

  /**
   * Handle hash32 field input — if user pastes a 32-byte pubkey (64 hex chars),
   * auto-compute blake2b-256 hash and replace the field value.
   * If user pastes a 64-char hex string that looks like it could already be a hash,
   * we keep it as-is (could be either pubkey or hash — user decides).
   */
  onHash32Input(paramName: string, value: string) {
    const normalized = (value || '').trim().replace(/^0x/i, '');
    this.templateFormValues[paramName + '_isAutoHashed'] = '';

    // If user pastes a pubkey (64 hex chars = 32 bytes), compute blake2b-256 hash
    // Check if it's a valid hex string first
    if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
      // It's 32 bytes — could be a pubkey or already a hash.
      // We provide a "compute hash" option rather than auto-replacing.
      return;
    }

    // If user pastes a Kaspa address, extract pubkey and hash it
    if (normalized.startsWith('kaspa') || normalized.startsWith('kaspatest')) {
      try {
        const pubkeyBytes = this.templatePatcher.kaspaAddressToPubkeyBytes(
          value.trim(),
        );
        const hashHex = this.computeBlake2bHex(pubkeyBytes);
        this.templateFormValues[paramName] = hashHex;
        this.templateFormValues[paramName + '_isAutoHashed'] = 'true';
      } catch {
        // Invalid address — let validation catch it
      }
    }
  }

  /**
   * Convert a 64-char hex string into a 32-byte Uint8Array.
   */
  private hex32ToBytes(value: string): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 64; i += 2) {
      bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Compute a blake2b-256 hash and return lowercase hex.
   */
  private computeBlake2bHex(input: ArrayLike<number>): string {
    const hash = blake2b(Uint8Array.from(input), { dkLen: 32 });
    return Array.from(hash)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Compute blake2b-256 hash of a hex value and update the field
   */
  computeBlake2bHash(paramName: string) {
    const value = (this.templateFormValues[paramName] || '')
      .trim()
      .replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(value)) return;

    this.templateFormValues[paramName] = this.computeBlake2bHex(
      this.hex32ToBytes(value),
    );
    this.templateFormValues[paramName + '_isAutoHashed'] = 'true';
  }

  // ─── Extra Args (int/bool params) ──────────────────────────────────

  /**
   * Collect extra args from the form into a Record<string, bigint> for the SDK.
   */
  private collectExtraArgs(
    compiled: CompiledContract,
    functionName: string,
  ): Record<string, bigint> {
    const abiEntry = compiled.abi.find((e) => e.name === functionName);
    if (!abiEntry) return {};

    const result: Record<string, bigint> = {};
    for (const input of abiEntry.inputs) {
      if (input.type_name === 'int' || input.type_name === 'bool') {
        const raw = this.extraArgValues[input.name];
        if (raw === undefined || raw === '') {
          throw new Error(`"${input.name}" (${input.type_name}) is required`);
        }
        result[input.name] = BigInt(raw);
      }
    }
    return result;
  }

  // ─── Two-Phase Signing (Multi-Sig / Escrow Release) ────────────────

  /**
   * Import a partial spend JSON from co-signer and complete it.
   */
  async completePartialSpend() {
    this.partialCompleteError.set(null);
    this.partialCompleteResult.set(null);

    const wallet = this.currentWallet();
    if (!wallet) {
      this.partialCompleteError.set('No wallet connected');
      return;
    }

    if (!this.importPartialJson.trim()) {
      this.partialCompleteError.set(
        'Paste the partial spend JSON from the co-signer',
      );
      return;
    }

    try {
      this.isCompletingPartial.set(true);
      const partial: PartiallySignedSpend = JSON.parse(this.importPartialJson);
      const actionResult =
        await this.walletActionService.validateAndDoActionAfterApproval({
          type: WalletActionType.COVENANT_COMPLETE_PARTIAL,
          data: {
            partialSpendJson: this.importPartialJson,
            contractName: this.getPartialContractName(partial),
          },
        });

      if (!actionResult.success || !actionResult.result) {
        this.partialCompleteError.set(
          'Covenant interaction was rejected or failed',
        );
        return;
      }

      const result = actionResult.result as CovenantCompletePartialActionResult;

      this.partialCompleteResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Update registry if we know the contract
      if (this.selectedContractId()) {
        const compiled = this.covenantService.parseCompiledContract(
          partial.compiledJson,
        );
        const covenantAddress =
          this.covenantService.getContractAddress(compiled);
        const continuationOutputIndex = partial.outputs.findIndex(
          (output) => output.address === covenantAddress,
        );
        if (continuationOutputIndex >= 0) {
          this.registryService.updateContract(this.selectedContractId(), {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: continuationOutputIndex },
            amountSompi: partial.outputs[continuationOutputIndex].amountSompi,
          });
        } else {
          this.registryService.updateContract(this.selectedContractId(), {
            status: 'spent',
            spendTxid: result.txid,
            lastChecked: Date.now(),
          });
        }
        this.loadContracts();
      }
    } catch (error: any) {
      this.partialCompleteError.set(
        error?.message || 'Failed to complete partial spend',
      );
    } finally {
      this.isCompletingPartial.set(false);
    }
  }

  /**
   * Copy partial spend JSON to clipboard
   */
  copyPartialSpend() {
    const json = this.partialSpendJson();
    if (!json) return;
    navigator.clipboard.writeText(json).then(
      () => alert('Partial spend JSON copied! Send it to the co-signer.'),
      () => prompt('Copy this partial spend JSON:', json),
    );
  }

  private getPartialContractName(partial: PartiallySignedSpend): string {
    try {
      const compiled = JSON.parse(partial.compiledJson) as CompiledContract;
      return compiled.contract_name || 'Covenant';
    } catch {
      return 'Covenant';
    }
  }

  // ─── Helpers for Escrow arbitrate ─────────────────────────────────

  /**
   * Scan the compiled script for all unique 32-byte pubkey pushes (OP_DATA_32 = 0x20).
   * Returns them in first-appearance order, which matches the SilverScript constructor
   * parameter order.
   */
  private extractPubkeysFromScript(compiled: CompiledContract): string[] {
    const scriptBytes = Uint8Array.from(compiled.script);
    const seen: string[] = [];
    for (let i = 0; i <= scriptBytes.length - 33; i++) {
      if (scriptBytes[i] === 0x20) {
        const pkHex = Array.from(scriptBytes.slice(i + 1, i + 33))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (!seen.includes(pkHex)) seen.push(pkHex);
      }
    }
    return seen;
  }

  /**
   * Convert an x-only 32-byte pubkey hex into a Kaspa P2PK address for the current network.
   */
  private pubkeyToAddress(pkHex: string): string {
    try {
      return new PublicKey(pkHex)
        .toAddress(this.rpcService.getNetwork())
        .toString();
    } catch (e) {
      console.warn('[Contracts] pubkeyToAddress failed for', pkHex, e);
      return '';
    }
  }
}
