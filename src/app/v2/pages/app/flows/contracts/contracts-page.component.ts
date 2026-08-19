import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownOption } from '@kaspacom/ui-kit';
import { WalletService } from '../../../../../services/wallet.service';
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
import { CompiledContract } from '../../../../../services/covenant/covenant-sdk/types';
import { ContractTemplate } from '../../../../services/covenant/contract-templates';
import {
  TemplatePatch,
  TemplatePatcherService,
} from '../../../../services/covenant/template-patcher.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { WideWorkspaceService } from '../../../../services/wide-workspace.service';
import {
  ApprovalFlowService,
  PendingActionConfirmation,
} from '../../../../services/approval-flow.service';
import {
  TabName,
  ContractDetailTab,
  ContractsTransientState,
  IndexerImportPreview,
  ContractDashboardFilter,
  ContractStatusFilter,
  ContractParticipant,
  ContractDashboardEntry,
  ContractDetailState,
  ContractDetailParameter,
  AvailableAction,
  ActionIndexerState,
  SELF_CUSTODY_WHITELIST_CAPACITY,
} from './contracts-page.models';
import { ContractDisplayService } from './services/contract-display.service';
import { CovenantTemplateService } from './services/covenant-template.service';
import {
  ContractsDataService,
  ContractsDashboardBuildContext,
} from './services/contracts-data.service';
import { ContractsRegistryRefreshService } from './services/contracts-registry-refresh.service';
import { hex32ToBytes, computeBlake2bHex } from './crypto.util';
import { ContractTemplateDeployFormComponent } from './components/contract-template-deploy-form/contract-template-deploy-form.component';
import { ContractsDashboardComponent } from './components/contracts-dashboard/contracts-dashboard.component';
import {
  ContractLookupImportComponent,
  LookupInteractRequest,
} from './components/contract-lookup-import/contract-lookup-import.component';
import { ContractActionPanelComponent } from './components/contract-action-panel/contract-action-panel.component';
import { ContractDetailComponent } from './components/contract-detail/contract-detail.component';

@Component({
  selector: 'app-contracts-page',
  imports: [
    CommonModule,
    FormsModule,
    ContractTemplateDeployFormComponent,
    ContractsDashboardComponent,
    ContractLookupImportComponent,
    ContractActionPanelComponent,
    ContractDetailComponent,
  ],
  templateUrl: './contracts-page.component.html',
  styleUrl: './contracts-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class ContractsPageComponent implements OnInit, OnDestroy {
  private readonly MIN_CONTINUATION_AMOUNT_SOMPI = 50_000_000n;

  private walletService = inject(WalletService);
  private covenantService = inject(CovenantService);
  private covenantIndexerService = inject(CovenantIndexerService);
  private rpcService = inject(RpcService);
  private registryService = inject(ContractRegistryService);
  private templatePatcher = inject(TemplatePatcherService);
  private flowPagesService = inject(FlowPagesService);
  wideWorkspaceService = inject(WideWorkspaceService);
  private approvalFlowService = inject(ApprovalFlowService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private display = inject(ContractDisplayService);
  private templateService = inject(CovenantTemplateService);
  private contractsData = inject(ContractsDataService);
  private contractsRegistryRefresh = inject(ContractsRegistryRefreshService);
  private registryMigrationPromise?: Promise<void>;
  private contractsLoadRequestToken = 0;
  private readonly contractsDebugEnabled = false;
  private readonly debugLogKeys = new Set<string>();

  private logContractsDebugOnce(
    key: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    if (!this.contractsDebugEnabled) return;
    if (this.debugLogKeys.has(key)) return;
    this.debugLogKeys.add(key);
    this.logContractsDebug(message, data);
  }

  private logContractsDebug(message: string, data?: Record<string, unknown>) {
    if (!this.contractsDebugEnabled) return;
    console.debug(message, data || {});
  }

  // Current active tab
  activeTab = signal<TabName>('my-contracts');

  // Current wallet
  currentWallet = computed(() => this.walletService.getCurrentWallet());

  // Deployment always uses the currently selected wallet.
  selectedAccount = computed(() => this.currentWallet() || undefined);

  // Computed pubkey for selected account
  selectedPubkey = computed(() => {
    const wallet = this.selectedAccount();
    if (!wallet) return '';
    return wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString();
  });

  selectedPubkeyHash = computed(() => {
    const pubkey = this.selectedPubkey();
    return pubkey ? computeBlake2bHex(hex32ToBytes(pubkey)) : '';
  });

  interactIndexerState = signal<ActionIndexerState | null>(null);

  // Contract registry (my contracts tab)
  allRegistryContracts = signal<ContractRegistryEntry[]>([]);
  registryContracts = signal<ContractRegistryEntry[]>([]);
  dashboardContracts = signal<ContractDashboardEntry[]>([]);
  dashboardFilter = signal<ContractDashboardFilter>('all');
  statusFilter = signal<ContractStatusFilter>('active');
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
          contract.contractTypeLabel,
          contract.aliasName,
          contract.currentAddress,
          contract.covenantId,
        ].some((value) => value?.toLowerCase().includes(search)),
      );
    }
    return this.sortDashboardEntries(list);
  });
  removableTrackedContractKeys = computed(
    () =>
      new Set(
        this.dashboardContracts()
          .filter((contract) => this.canRemoveTrackedContract(contract))
          .map((contract) => this.getAliasEditKey(contract)),
      ),
  );
  dashboardLoading = signal(false);
  indexerLoading = signal(false);
  dashboardError = signal<string | null>(null);
  selectedDetail = signal<ContractDetailState | null>(null);
  selectedDetailLoading = signal(false);
  editingAliasKey = signal<string | null>(null);
  aliasNotice = signal<{ key: string; message: string } | null>(null);
  aliasDraft = '';
  /**
   * Bumped on every openContractDetail() call so a slower, superseded fetch
   * (e.g. a route-driven load racing a direct row click for the same
   * contract) can detect it's stale and skip writing its results — otherwise
   * the two interleave and the actions panel flickers ready -> loading ->
   * ready as each one's writes land out of order.
   */
  private detailRequestToken = 0;
  /**
   * Entry id of the contract whose action form the user explicitly opened
   * via selectDetailAction() (clicking a specific action in the list), so a
   * same-entry prepareDashboardAction() call that resolves later — e.g. the
   * indexer lookup timing out and falling back to the local registry entry —
   * doesn't clobber it with selectDefaultFunctionForContract()'s pick.
   * navigateToContractDetail() always resets actionPageView to 'list' on a
   * fresh open, so this only guards a form the user is still actually in.
   */
  private userPickedFunctionForEntryId: string | null = null;
  /**
   * Tracks which non-silent openContractDetail()/prepareDashboardAction()
   * call is allowed to clear selectedDetailLoading. detailRequestToken is
   * bumped by EVERY call including silent background refreshes (e.g. the
   * loadContracts() polling loop), so gating the loading-flag reset on
   * `requestToken === this.detailRequestToken` let a silent call that
   * started after a non-silent one strand the flag at true forever — the
   * non-silent call's own reset would never fire since its token no longer
   * matched, and the silent call never touches the flag at all. This
   * separate token is only ever written by non-silent calls, so it isn't
   * disturbed by concurrent silent ones.
   */
  private loadingRequestToken = 0;
  /**
   * True right after a covenant action succeeds, until the user explicitly
   * navigates again (navigateToContractDetail()/openDashboardAction()).
   * Carried across the destroy/recreate cycle via transient state (see
   * restoreTransientState()) — the flow-page outlet destroys and recreates
   * this component the instant the approval overlay covers and uncovers it,
   * so a plain in-memory flag wouldn't survive from the action to the
   * "Done" click.
   *
   * Two effects while true:
   *  - the template hides the "Available actions" panel (see
   *    contracts-page.component.html) so landing back on a contract after
   *    finishing an action shows plain details, not an immediate prompt to
   *    take another one — that panel is otherwise shown unconditionally
   *    whenever actionPageView() is 'list', with no other state to
   *    distinguish "just finished acting on this" from "opened it fresh".
   *  - openContractDetail() skips its auto-jump into an available action's
   *    form (the `!hasEnabledDefault` branch of prepareDashboardAction) —
   *    without it, the freshly re-created instance (and every subsequent
   *    background refresh from the indexing poll) could still jump straight
   *    into a form instead of landing on details.
   */
  hideActionsAfterCompletion = signal(false);
  /**
   * Registry id of the contract to open straight to details for, restored
   * from transient state by restoreTransientState() and consumed once by
   * loadContracts()'s tail — see markActionCompleteForDetailsLanding(). A
   * freshly re-created instance otherwise has no route id and no
   * selectedDetail, so it would land on the plain "My Contracts" list
   * instead of the contract the user just finished acting on.
   */
  private pendingLandOnContractId?: string;
  /**
   * Set in ngOnDestroy(). This component is torn down by the flow-page
   * outlet whenever it hosts the "contracts" flow page (see
   * bailIfLeftContractsFlow()'s doc comment) — but it's also directly
   * routed at /app/contracts (see logged.routes.ts), and in that hosting
   * mode the approval overlay layers on top via the flow-page outlet
   * without ever destroying this instance, so isPageInStack('contracts')
   * is permanently false (this page was never pushed onto that stack)
   * even though the user never left. Gating the bail on this flag too
   * means "not in the flow-page stack" only counts as "left" once this
   * specific instance has actually been destroyed.
   */
  private destroyed = false;
  selectedDetailError = signal<string | null>(null);
  detailPanelTab = signal<ContractDetailTab>('details');
  /**
   * Whether the "action" panel shows the curated action list or one
   * selected action's full-page form — mutually exclusive with the list
   * once an action is picked, unlike detailPanelTab which just toggles
   * whether this whole panel appears below the always-visible details.
   */
  actionPageView = signal<'list' | 'form'>('list');
  private readonly supportedIndexerTemplates = [
    'DeadManSwitch',
    'TimeLockVault',
    'MultiSigVault',
    'EscrowWithArbiter',
    'SelfCustodyVault',
  ];

  /**
   * Maps a contract to one of the four v1 template keys — drives card accent,
   * icon, role labels, and which action UI is shown. Presentation-only.
   * Reuses the canonical name already computed by normalizeContractName()
   * (indexer label + argument-name fallback, resolved upstream in #257 and
   * stored as contractName on every ContractDashboardEntry); unresolved
   * (tracking-incomplete / unrecognized) → 'default' (neutral UI).
   */
  getTemplateKey(
    input: any,
  ):
    'deadman' | 'timelock' | 'multisig' | 'escrow' | 'selfcustody' | 'default' {
    return this.display.getTemplateKey(input);
  }

  readonly selfCustodyWhitelistCapacity = SELF_CUSTODY_WHITELIST_CAPACITY;

  // Interact form - plain properties for ngModel
  selectedContractId = signal('');
  interactContractJson = signal('');
  interactOutpointTxid = '';
  interactOutpointVout = '';
  interactInputAmount = '';
  interactOutputAddress = '';
  interactResolvedOutputAddress: string | null = null;

  // Lookup form
  interactOutputAmount = '';
  topUpAmount = '';
  selectedFunction = '';

  // Command channel for ContractActionPanelComponent: selectDetailAction() /
  // selectDefaultFunctionForContract() need to trigger its selectFunction()
  // from outside. A fresh object identity per request guarantees the
  // panel's effect re-fires even if the same function name is picked twice
  // in a row (signals skip re-notification on equal values).
  pendingFunctionSelect = signal<{ fn: string } | null>(null);

  indexerImportQuery = '';
  indexerImportLoading = signal(false);
  indexerImportError = signal<string | null>(null);
  indexerImportPreview = signal<IndexerImportPreview | null>(null);

  interactResult = signal<{ txid: string; functionName: string } | null>(null);
  interactError = signal<string | null>(null);

  // Two-phase signing (multi-sig / escrow release)
  partialSpendJson = signal<string | null>(null);
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

  /**
   * The pending partial-spend JSON (if any), scoped to the contract currently
   * shown in the "detail" tab. `partialSpendJson` is a single shared signal,
   * so this guards against showing a stale co-signer JSON left over from a
   * different contract's action.
   */
  partialSpendJsonForDetail = computed(() => {
    const json = this.partialSpendJson();
    const detail = this.selectedDetail();
    if (!json || !detail) return null;
    const registryId = detail.entry.registryEntry?.id;
    if (registryId && registryId !== this.selectedContractId()) return null;
    return json;
  });

  registryContractOptions = computed<DropdownOption[]>(() =>
    this.registryContracts().map((contract) => ({
      value: contract.id,
      label: `${this.getContractDisplayName(contract)} - ${this.getContractTypeLabel(contract)} (${this.getRegistryContractIdentityLabel(contract)})`,
      disabled: contract.status === 'spent',
    })),
  );

  // Computed parsed contract from interact JSON
  parsedInteractContract = computed(() => {
    try {
      const json =
        this.interactContractJson() || this.selectedContract()?.compiledJson;
      if (!json) {
        const detail = this.selectedDetail();
        this.logContractsDebugOnce(
          `parsed:no-json:${detail?.entry.id || 'none'}:${this.selectedContractId() || 'none'}`,
          '[Contracts][actions] No interact contract JSON selected',
          {
            selectedContractId: this.selectedContractId(),
            detailEntryId: detail?.entry.id,
            detailCovenantId: detail?.entry.covenantId,
            detailStatus: detail?.entry.status,
            interactJsonLength: this.interactContractJson().length,
          },
        );
        return null;
      }
      return this.covenantService.parseCompiledContract(json);
    } catch (error) {
      const detail = this.selectedDetail();
      console.warn('[Contracts][actions] Failed to parse interact contract', {
        selectedContractId: this.selectedContractId(),
        detailEntryId: detail?.entry.id,
        detailCovenantId: detail?.entry.covenantId,
        interactJsonLength: this.interactContractJson().length,
        error,
      });
      return null;
    }
  });

  // Available entrypoint functions for interact
  availableFunctions = computed(() => {
    const contract = this.parsedInteractContract();
    if (!contract) {
      const detail = this.selectedDetail();
      this.logContractsDebugOnce(
        `available:no-contract:${detail?.entry.id || 'none'}:${this.selectedContractId() || 'none'}`,
        '[Contracts][actions] availableFunctions is empty because no parsed contract is available',
        {
          selectedContractId: this.selectedContractId(),
          detailEntryId: detail?.entry.id,
          detailCovenantId: detail?.entry.covenantId,
          detailStatus: detail?.entry.status,
          selectedDetailLoading: this.selectedDetailLoading(),
          currentWallet: !!this.currentWallet(),
        },
      );
      return [];
    }
    let funcs = contract.abi.filter((entry) =>
      contract.ast.functions.find((f) => f.name === entry.name && f.entrypoint),
    );

    // Dead Man's Switch never exposes a generic "withdraw" — it was removed
    // from the template, but legacy on-chain contracts compiled while it was
    // briefly part of the template may still report it in their ABI. A
    // generic withdrawal would let the owner drain the full balance to an
    // arbitrary address, bypassing the mandatory continuation. Hide it
    // outright rather than relying on the current template's ABI.
    if (contract.contract_name === 'DeadManSwitch') {
      funcs = funcs.filter((f) => f.name !== 'withdraw');
    }

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

    // Inject 'changeHeir' action for Dead Man's Switch contracts in case the
    // compiled ABI predates this entrypoint being added to the template.
    if (
      contract.contract_name === 'DeadManSwitch' &&
      !funcs.some((f) => f.name === 'changeHeir')
    ) {
      funcs.push({
        name: 'changeHeir',
        inputs: [{ name: 'newHeir', type_name: 'pubkey' }],
      } as any);
    }

    if (funcs.length === 0) {
      console.warn(
        '[Contracts][actions] Parsed contract has no available entrypoints',
        {
          contractName: contract.contract_name,
          abiNames: contract.abi.map((entry) => entry.name),
          astEntrypoints: contract.ast.functions
            .filter((fn) => fn.entrypoint)
            .map((fn) => fn.name),
          selectedContractId: this.selectedContractId(),
          detailCovenantId: this.selectedDetail()?.entry.covenantId,
        },
      );
    }

    return funcs;
  });

  // Current network
  network = computed(() => this.rpcService.getNetwork());

  constructor() {
    // Reload My-Contracts whenever the active network changes (also runs once now).
    effect(() => {
      this.network();
      this.loadContracts();
    });

    effect(() => {
      const refreshVersion = this.contractsRegistryRefresh.changes();
      if (refreshVersion === 0) return;
      void this.loadContracts({ skipOnChainStatusRefresh: true });
    });
  }

  ngOnInit() {
    this.wideWorkspaceService.activate();
    void this.ensureContractRegistryMigrated();
    this.restoreTransientState();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.wideWorkspaceService.deactivate();
  }

  private restoreTransientState() {
    const state =
      this.flowPagesService.getTransientState<ContractsTransientState>(
        'contracts',
      );
    if (!state) return;

    // 'detail' can't be restored: selectedDetail (the fetched contract/
    // registry/indexer data) isn't part of this snapshot — re-fetching it
    // here would need the covenant identifier, which interactContract()
    // doesn't currently save. Landing on 'detail' with no selectedDetail
    // renders a blank panel (only its loading/error/not-found states are
    // conditional; the happy-path detail view requires selectedDetail).
    // 'my-contracts' is always populated by this point (ngOnInit's network
    // effect already ran loadContracts()), so it's a safe, working fallback.
    if (state.activeTab) {
      this.activeTab.set(
        state.activeTab === 'detail' ? 'my-contracts' : state.activeTab,
      );
    }
    if (state.detailPanelTab) this.detailPanelTab.set(state.detailPanelTab);
    if (state.actionPageView) this.actionPageView.set(state.actionPageView);
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
    if (state.hideActionsAfterCompletion)
      this.hideActionsAfterCompletion.set(true);
    if (state.landOnContractId)
      this.pendingLandOnContractId = state.landOnContractId;

    this.flowPagesService.saveTransientState('contracts', undefined);
  }

  private ensureContractRegistryMigrated(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    this.registryMigrationPromise ??=
      this.registryService.migrateContractsRegistryFromLocalStorage();
    return this.registryMigrationPromise;
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
    // A hex id/txid/script-hash query must resolve to an exact match — falling
    // back to "the only row the fuzzy search returned" risks silently
    // substituting an unrelated covenant (e.g. while the real one is still
    // indexer-lagged and its direct lookup above failed).
    const row = exactRow || (isHexIdentifier ? undefined : supportedRows[0]);
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
        /^[0-9a-fA-F]{64}$/.test(result.id) &&
        (!isHexIdentifier ||
          this.normalizeIdentity(result.id) === normalizedQuery),
    );
    if (concrete?.id) {
      return await this.fetchIndexerCovenant(concrete.id);
    }

    throw new Error(
      isHexIdentifier
        ? 'This covenant is not indexed yet. It may still be catching up with the network — try again shortly.'
        : 'No importable wallet-supported covenant found for that query.',
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

  /** 'detail' belongs to the My Contracts section for tab-highlighting purposes. */
  isMyContractsTabActive = computed(
    () => this.activeTab() === 'my-contracts' || this.activeTab() === 'detail',
  );

  /**
   * Load contracts from registry and check on-chain status
   */
  async loadContracts(options: { skipOnChainStatusRefresh?: boolean } = {}) {
    const requestToken = ++this.contractsLoadRequestToken;
    const isCurrentRequest = () =>
      requestToken === this.contractsLoadRequestToken;

    await this.ensureContractRegistryMigrated();
    if (!isCurrentRequest()) return;

    this.dashboardLoading.set(true);
    this.dashboardError.set(null);
    if (this.activeTab() !== 'detail') {
      this.selectedDetail.set(null);
      this.selectedDetailError.set(null);
    }

    // A fresh instance (e.g. re-created after the approval overlay covered
    // and then uncovered this page — see ApprovalFlowService.waitForActionIndexing)
    // otherwise has no idea an action-indexing poll from the previous instance
    // is still in flight, and its own first load races ahead of it, showing
    // stale data. `skipOnChainStatusRefresh` is only ever passed by that same
    // poll's own internal calls, so gating on its absence can't deadlock.
    if (!options.skipOnChainStatusRefresh) {
      await this.approvalFlowService.waitForActionIndexing();
    }
    if (!isCurrentRequest()) return;

    const walletKey = this.currentWalletAliasKey();
    const currentRoleCandidates = this.currentWalletRoleCandidates();
    const buildCtx = (
      localRegistryContracts: ContractRegistryEntry[],
      allRegistryContracts: ContractRegistryEntry[],
    ): ContractsDashboardBuildContext => ({
      localRegistryContracts,
      allRegistryContracts,
      network: this.network(),
      walletKey,
      currentRoleCandidates,
    });

    const allContracts = await this.registryService.getAllContracts();
    if (!isCurrentRequest()) return;

    this.allRegistryContracts.set(allContracts);
    const filtered = await this.getCurrentWalletLocalContracts(allContracts);
    if (!isCurrentRequest()) return;

    this.registryContracts.set(filtered);
    let localDashboardEntries = await Promise.all(
      filtered.map((entry) =>
        this.contractsData.localEntryToDashboard(
          entry,
          buildCtx(filtered, allContracts),
        ),
      ),
    );
    if (!isCurrentRequest()) return;

    this.dashboardContracts.set(
      this.sortDashboardEntries(localDashboardEntries),
    );
    this.dashboardLoading.set(false);

    const wallet = this.currentWallet();
    const indexerEntriesPromise =
      this.contractsData.loadIndexerDashboardEntries(
        [wallet?.getAddress(), this.currentWalletPubkeyHash()],
        buildCtx(filtered, allContracts),
      );
    this.indexerLoading.set(true);

    // Check on-chain status for each contract. Skipped during action-indexing
    // polling (trackActionIndexing()): the acted-on contract's status/amount
    // is already applied optimistically to the local registry by the action
    // itself, so repeating an RPC UTXO lookup across every local contract on
    // each poll tick is redundant traffic, not new information.
    const localRefreshPromise = options.skipOnChainStatusRefresh
      ? Promise.resolve(localDashboardEntries)
      : (async () => {
          await this.refreshContractStatuses(filtered);
          if (!isCurrentRequest()) return localDashboardEntries;

          const updatedAllContracts =
            await this.registryService.getAllContracts();
          if (!isCurrentRequest()) return localDashboardEntries;

          this.allRegistryContracts.set(updatedAllContracts);
          const updatedLocal =
            await this.getCurrentWalletLocalContracts(updatedAllContracts);
          if (!isCurrentRequest()) return localDashboardEntries;

          this.registryContracts.set(updatedLocal);
          const refreshedLocalDashboardEntries = await Promise.all(
            updatedLocal.map((entry) =>
              this.contractsData.localEntryToDashboard(
                entry,
                buildCtx(updatedLocal, updatedAllContracts),
              ),
            ),
          );
          if (!isCurrentRequest()) return localDashboardEntries;

          this.dashboardContracts.set(
            this.sortDashboardEntries(refreshedLocalDashboardEntries),
          );
          return refreshedLocalDashboardEntries;
        })();

    try {
      // Indexer-backed tracking is the source of truth for contracts involving
      // the wallet. Local registry entries are merged below so older local-only
      // deployments still remain visible while the indexer catches up.
      const [indexerEntries] = await Promise.all([
        indexerEntriesPromise,
        localRefreshPromise,
      ]);
      if (!isCurrentRequest()) return;

      localDashboardEntries = await this.getLatestLocalDashboardEntries(
        buildCtx,
        isCurrentRequest,
      );
      if (!isCurrentRequest()) return;

      this.dashboardContracts.set(
        this.contractsData.mergeDashboardEntries(
          indexerEntries,
          localDashboardEntries,
          walletKey,
        ),
      );
    } catch (error: any) {
      if (!isCurrentRequest()) return;
      console.warn('[Contracts] Indexer dashboard load failed:', error);
      this.dashboardError.set(
        error?.message ||
          'Indexer tracking is unavailable. Showing locally saved contracts only.',
      );
      localDashboardEntries = await this.getLatestLocalDashboardEntries(
        buildCtx,
        isCurrentRequest,
      );
      if (!isCurrentRequest()) return;

      this.dashboardContracts.set(
        this.sortDashboardEntries(localDashboardEntries),
      );
    } finally {
      if (isCurrentRequest()) {
        this.indexerLoading.set(false);
      }
    }

    if (!isCurrentRequest()) return;

    if (this.activeTab() === 'detail' && this.selectedDetail()) {
      // An open detail view isn't cleared above (so the panel doesn't flash
      // empty), but it also needs to be re-fetched with the freshly merged
      // entry — otherwise fields like the check-in deadline stay stuck at
      // whatever they were when the panel was first opened, even after an
      // action (e.g. keepAlive) has changed them on-chain.
      const current = this.selectedDetail()!.entry;
      const refreshed = this.dashboardContracts().find(
        (entry) =>
          this.sameIdentity(entry.covenantId, current.covenantId) ||
          this.sameIdentity(entry.deployTxid, current.deployTxid) ||
          this.sameIdentity(entry.scriptHash, current.scriptHash) ||
          entry.id === current.id,
      );
      if (refreshed) {
        await this.openContractDetail(refreshed, { silent: true });
      }
    } else if (this.pendingLandOnContractId) {
      // Land on the contract an action just completed on — see
      // pendingLandOnContractId's doc comment. One-shot: clear it regardless
      // of whether a match was found, so it doesn't stick around and hijack
      // some later, unrelated load.
      const contractId = this.pendingLandOnContractId;
      this.pendingLandOnContractId = undefined;
      const target = this.dashboardContracts().find(
        (entry) => entry.registryEntry?.id === contractId,
      );
      if (target) {
        this.activeTab.set('detail');
        await this.openContractDetail(target);
      }
    }
  }

  /**
   * The indexer request can take long enough for the user to edit local
   * metadata such as nicknames while "Syncing indexer contracts" is visible.
   * Re-read the registry at the final dashboard commit point so an older
   * loadContracts() snapshot cannot overwrite those local edits.
   */
  private async getLatestLocalDashboardEntries(
    buildCtx: (
      localRegistryContracts: ContractRegistryEntry[],
      allRegistryContracts: ContractRegistryEntry[],
    ) => ContractsDashboardBuildContext,
    isCurrentRequest: () => boolean,
  ): Promise<ContractDashboardEntry[]> {
    const allContracts = await this.registryService.getAllContracts();
    if (!isCurrentRequest()) return [];

    this.allRegistryContracts.set(allContracts);
    const filtered = await this.getCurrentWalletLocalContracts(allContracts);
    if (!isCurrentRequest()) return [];
    this.registryContracts.set(filtered);

    const dashboardEntries = await Promise.all(
      filtered.map((entry) =>
        this.contractsData.localEntryToDashboard(
          entry,
          buildCtx(filtered, allContracts),
        ),
      ),
    );
    return isCurrentRequest() ? dashboardEntries : [];
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

    const statusUpdates = (
      await Promise.all(
        Array.from(addressMap.entries()).map(async ([address, entries]) => {
          const updates: Array<{
            id: string;
            changes: Partial<ContractRegistryEntry>;
          }> = [];

          try {
            const utxoResponse = await rpc.getUtxosByAddresses({
              addresses: [address],
            });
            const utxos = utxoResponse.entries || [];

            for (const entry of entries) {
              const found = utxos.find(
                (u: any) =>
                  u.outpoint?.transactionId === entry.outpoint.txid &&
                  Number(u.outpoint?.index ?? -1) === entry.outpoint.vout,
              );

              const newStatus: ContractStatus = found ? 'active' : 'spent';
              if (entry.status !== newStatus) {
                updates.push({
                  id: entry.id,
                  changes: {
                    status: newStatus,
                    lastChecked: Date.now(),
                    amountSompi: found
                      ? found.amount.toString()
                      : entry.amountSompi,
                  },
                });
              }
            }
          } catch (err) {
            console.warn('[Contracts] Status check failed for', address, err);
          }

          return updates;
        }),
      )
    ).flat();

    for (const { id, changes } of statusUpdates) {
      try {
        await this.updateRegistryContract(id, changes);
      } catch (err) {
        console.warn('[Contracts] Status update failed for', id, err);
      }
    }

    // Reload with updated statuses
    const updatedAllContracts = await this.registryService.getAllContracts();
    this.allRegistryContracts.set(updatedAllContracts);
    const updated =
      await this.getCurrentWalletLocalContracts(updatedAllContracts);
    this.registryContracts.set(updated);
  }

  private async getCurrentWalletLocalContracts(
    contracts: ContractRegistryEntry[],
  ): Promise<ContractRegistryEntry[]> {
    const result: ContractRegistryEntry[] = [];
    for (const contract of contracts) {
      if (contract.network !== this.network()) continue;
      if (this.isCurrentWalletRegistryEntry(contract)) {
        result.push(contract);
        continue;
      }
      if (await this.isCurrentWalletLocalParticipant(contract)) {
        const updated = await this.addCurrentWalletToRegistryContract(contract);
        result.push(updated || contract);
      }
    }
    return result;
  }

  private async isCurrentWalletLocalParticipant(
    contract: ContractRegistryEntry,
  ): Promise<boolean> {
    try {
      return (
        this.currentWalletRoles(await this.localParticipants(contract)).length >
        0
      );
    } catch {
      return false;
    }
  }

  private async updateRegistryContract(
    id: string,
    updates: Partial<ContractRegistryEntry>,
  ): Promise<void> {
    await this.registryService.updateContract(id, updates);
    if (updates.compiledJson) {
      this.contractsData.clearLocalParticipantsCache();
    }
    // An action just executed locally, so it's by definition the freshest
    // known state for this contract — surface it on the card immediately
    // rather than waiting for the next full loadContracts()/indexer merge
    // (which may still lag until the indexer catches up).
    const optimisticLatest = updates.lastActionType
      ? {
          latestAction: updates.lastActionType,
          latestTxid:
            updates.lastActionTxid ||
            updates.spendTxid ||
            updates.outpoint?.txid,
        }
      : undefined;
    let updatedRegistryEntry: ContractRegistryEntry | undefined;
    this.allRegistryContracts.set(
      this.allRegistryContracts().map((contract) => {
        if (contract.id !== id) return contract;
        updatedRegistryEntry = { ...contract, ...updates };
        return updatedRegistryEntry;
      }),
    );
    this.registryContracts.set(
      (() => {
        const current = this.registryContracts();
        let found = false;
        const updated = current.map((contract) => {
          if (contract.id !== id) return contract;
          found = true;
          return { ...contract, ...updates };
        });
        if (
          !found &&
          updatedRegistryEntry &&
          this.isCurrentWalletRegistryEntry(updatedRegistryEntry)
        ) {
          this.logContractsDebug(
            '[Contracts][registry] Added updated entry to current wallet registry view',
            {
              registryId: updatedRegistryEntry.id,
              contractAddress: updatedRegistryEntry.contractAddress,
              outpoint: updatedRegistryEntry.outpoint,
              covenantId: updatedRegistryEntry.covenantId,
              walletKeys: Object.keys(updatedRegistryEntry.wallets || {}),
            },
          );
          return [...updated, updatedRegistryEntry];
        }
        return updated;
      })(),
    );
    this.dashboardContracts.set(
      this.dashboardContracts().map((entry) =>
        entry.registryEntry?.id === id
          ? this.withDashboardName({
              ...entry,
              aliases: updatedRegistryEntry?.aliases,
              registryEntry: updatedRegistryEntry || {
                ...entry.registryEntry,
                ...updates,
              },
              ...optimisticLatest,
            })
          : entry,
      ),
    );
    this.selectedDetail.update((detail) =>
      detail?.entry.registryEntry?.id === id
        ? {
            ...detail,
            entry: this.withDashboardName({
              ...detail.entry,
              aliases: updatedRegistryEntry?.aliases,
              registryEntry: updatedRegistryEntry || {
                ...detail.entry.registryEntry,
                ...updates,
              },
              ...optimisticLatest,
            }),
          }
        : detail,
    );
  }

  private isCurrentWalletRegistryEntry(
    contract: ContractRegistryEntry,
  ): boolean {
    const walletKey = this.currentWalletAliasKey();
    if (walletKey && contract.wallets) return !!contract.wallets[walletKey];

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

  canRemoveTrackedContract(contract: ContractDashboardEntry): boolean {
    return (
      !!contract.registryEntry &&
      this.currentWalletRoles(contract.participants || []).length === 0
    );
  }

  async removeTrackedContract(contract: ContractDashboardEntry) {
    const registryEntry = contract.registryEntry;
    if (!registryEntry || !this.canRemoveTrackedContract(contract)) return;

    const walletKey = this.currentWalletAliasKey();
    const wallets = { ...(registryEntry.wallets || {}) };
    if (walletKey) {
      delete wallets[walletKey];
    }

    const hasRemainingWallets = Object.values(wallets).some(Boolean);
    if (hasRemainingWallets) {
      await this.updateRegistryContract(registryEntry.id, { wallets });
    } else {
      await this.registryService.deleteContract(registryEntry.id);
    }

    this.selectedDetail.set(null);
    this.selectedDetailError.set(null);
    if (this.activeTab() === 'detail') {
      this.activeTab.set('my-contracts');
    }
    await this.loadContracts();
  }

  private async addCurrentWalletToRegistryContract(
    contract: ContractRegistryEntry,
  ): Promise<ContractRegistryEntry | undefined> {
    const walletKey = this.currentWalletAliasKey();
    if (!walletKey) return undefined;
    const wallets = { ...(contract.wallets || {}), [walletKey]: true };
    await this.updateRegistryContract(contract.id, { wallets });
    return { ...contract, wallets };
  }

  private findSavedRegistryEntryForIdentity(input: {
    covenantId?: string;
    deployTxid?: string;
    outpoint?: { txid: string; vout: number };
  }): ContractRegistryEntry | undefined {
    return this.contractsData.findSavedRegistryEntryForIdentity(
      input,
      this.allRegistryContracts(),
      this.network(),
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
    return pubkey ? computeBlake2bHex(hex32ToBytes(pubkey)) : undefined;
  }

  currentWalletAliasKey(): string | undefined {
    return this.currentWallet()?.getIdWithAccount();
  }

  getContractAlias(contract: {
    aliases?: Record<string, string>;
  }): string | undefined {
    return this.contractsData.getContractAlias(
      contract,
      this.currentWalletAliasKey(),
    );
  }

  private getContractAliasOwnerKey(contract: {
    aliases?: Record<string, string>;
  }): string | undefined {
    return this.contractsData.getContractAliasOwnerKey(
      contract,
      this.currentWalletAliasKey(),
    );
  }

  getContractTypeLabel(contract: { contractName?: string }): string {
    return this.display.getContractTypeLabel(contract);
  }

  getContractDisplayName(contract: {
    contractName?: string;
    aliases?: Record<string, string>;
  }): string {
    return this.contractsData.getContractDisplayName(
      contract,
      this.currentWalletAliasKey(),
    );
  }

  getAliasEditKey(contract: ContractDashboardEntry): string {
    return contract.registryEntry?.id || contract.id;
  }

  canEditContractAlias(contract: ContractDashboardEntry): boolean {
    return !!contract.registryEntry;
  }

  getAliasUnavailableMessage(): string {
    return 'Import this contract before adding a nickname.';
  }

  private showAliasUnavailableNotice(contract: ContractDashboardEntry) {
    this.aliasNotice.set({
      key: this.getAliasEditKey(contract),
      message: this.getAliasUnavailableMessage(),
    });
  }

  beginAliasEdit(contract: ContractDashboardEntry) {
    if (!this.canEditContractAlias(contract)) {
      this.showAliasUnavailableNotice(contract);
      return;
    }
    this.editingAliasKey.set(this.getAliasEditKey(contract));
    this.aliasNotice.set(null);
    const currentWalletKey = this.currentWalletAliasKey();
    this.aliasDraft =
      (currentWalletKey ? contract.aliases?.[currentWalletKey] : '') ||
      contract.aliasName ||
      '';
  }

  cancelAliasEdit() {
    this.editingAliasKey.set(null);
    this.aliasNotice.set(null);
    this.aliasDraft = '';
  }

  async saveAlias(
    contract: ContractDashboardEntry,
    draft: string = this.aliasDraft,
  ) {
    const walletKey = this.currentWalletAliasKey();
    const registryEntry = contract.registryEntry;
    if (!registryEntry) {
      this.showAliasUnavailableNotice(contract);
      this.editingAliasKey.set(null);
      return;
    }
    if (!walletKey) return;

    const alias = draft.trim();
    const aliases = { ...(registryEntry.aliases || {}) };
    if (alias) {
      aliases[walletKey] = alias;
    } else {
      delete aliases[walletKey];
    }
    await this.updateRegistryContract(registryEntry.id, { aliases });
    this.refreshDashboardNames();
    this.aliasNotice.set(null);
    this.cancelAliasEdit();
  }

  async removeAlias(contract: ContractDashboardEntry) {
    const walletKey = this.currentWalletAliasKey();
    const registryEntry = contract.registryEntry;
    if (!registryEntry) {
      this.showAliasUnavailableNotice(contract);
      return;
    }
    if (!walletKey) return;

    const ownerKey = this.getContractAliasOwnerKey(contract);
    if (ownerKey && ownerKey !== walletKey) {
      const walletLabel = this.getAliasOwnerWalletLabel(ownerKey);
      this.aliasNotice.set({
        key: this.getAliasEditKey(contract),
        message: `This nickname was given by ${walletLabel}. Please remove it from there.`,
      });
      return;
    }

    const aliases = { ...(registryEntry.aliases || {}) };
    delete aliases[walletKey];
    await this.updateRegistryContract(registryEntry.id, { aliases });
    this.refreshDashboardNames();
    this.aliasNotice.set(null);
    this.cancelAliasEdit();
  }

  private getAliasOwnerWalletLabel(walletKey: string): string {
    const wallet =
      this.walletService.getAllWalletsByIdAndAccount()?.[walletKey];
    if (!wallet) return `wallet ${walletKey}`;

    const walletName = wallet.getName();
    const accountName = wallet.getAccountName() || 'No account';
    const address = this.truncate(wallet.getAddress(), 22);
    return `${walletName}, ${accountName}, ${address}`;
  }

  private refreshDashboardNames() {
    this.dashboardContracts.set(
      this.dashboardContracts().map((entry) => this.withDashboardName(entry)),
    );
    this.selectedDetail.update((detail) =>
      detail
        ? { ...detail, entry: this.withDashboardName(detail.entry) }
        : detail,
    );
  }

  private withDashboardName(
    entry: ContractDashboardEntry,
  ): ContractDashboardEntry {
    return this.contractsData.withDashboardName(
      entry,
      this.currentWalletAliasKey(),
    );
  }

  private mergeParticipants(
    localParticipants: ContractParticipant[] | undefined,
    indexerParticipants: ContractParticipant[] | undefined,
  ): ContractParticipant[] {
    return this.contractsData.mergeParticipants(
      localParticipants,
      indexerParticipants,
    );
  }

  private latestAction(
    actions: IndexerCovenantAction[],
  ): IndexerCovenantAction | undefined {
    return this.contractsData.latestAction(actions);
  }

  private getIndexerTemplateName(summary: IndexerCovenantDetails): string {
    return this.contractsData.getIndexerTemplateName(summary);
  }

  private normalizeContractName(name: string): string {
    return this.display.normalizeContractName(name);
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

  private async localParticipants(
    contract: ContractRegistryEntry,
  ): Promise<ContractParticipant[]> {
    const predecessor = contract.predecessorId
      ? this.registryContracts().find(
          (entry) => entry.id === contract.predecessorId,
        )
      : undefined;
    return this.contractsData.localParticipants(contract, predecessor);
  }

  private indexerParticipants(
    summary: IndexerCovenantDetails,
  ): ContractParticipant[] {
    return this.contractsData.indexerParticipants(summary);
  }

  private normalizeIndexerArgs(rawArgs: unknown): IndexerCovenantArg[] {
    return this.contractsData.normalizeIndexerArgs(rawArgs);
  }

  private getParticipantDisplayValue(
    role: string,
    value: string,
    type?: string,
  ): { label: string; value: string } {
    return this.contractsData.getParticipantDisplayValue(role, value, type);
  }

  getContractDetailParameters(
    detail: ContractDetailState,
  ): ContractDetailParameter[] {
    const covenant = detail.response?.covenant || detail.entry.indexerSummary;
    const params: ContractDetailParameter[] = [];
    const seen = new Set<string>();
    const addParam = (name: string, value: unknown, type?: string) => {
      if (value === undefined || value === null || value === '') return;
      const display = this.getParticipantDisplayValue(
        name,
        String(value),
        type,
      );
      const key = display.label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      params.push({
        label: display.label,
        value: display.value,
        type,
      });
    };

    for (const arg of this.normalizeIndexerArgs(covenant?.claimedArgs?.args)) {
      addParam(arg.name, arg.value, arg.type);
    }

    const constructorArgs = covenant?.constructor || {};
    for (const [name, value] of Object.entries(constructorArgs)) {
      addParam(name, value);
    }

    if (params.length === 0) {
      const localArgs = this.localTemplateArgs(detail.entry.registryEntry);
      for (const arg of localArgs) {
        addParam(arg.name, arg.value, arg.type);
      }
    }

    for (const participant of detail.entry.participants || []) {
      if (!participant) continue;
      if (participant.hidden) continue;
      addParam(participant.label, participant.value);
    }

    return params;
  }

  private localTemplateArgs(
    contract: ContractRegistryEntry | undefined,
  ): IndexerCovenantArg[] {
    if (!contract?.compiledJson) return [];
    try {
      const compiled = this.covenantService.parseCompiledContract(
        contract.compiledJson,
      );
      return Array.isArray(compiled.tn10?.args) ? compiled.tn10.args : [];
    } catch {
      return [];
    }
  }

  /**
   * All participant roles the current wallet matches. A wallet can legitimately
   * hold more than one role (e.g. the same address used for buyer and arbiter
   * in a test deploy) — returning just the first match would silently hide
   * actions gated on a role that isn't the first one listed.
   */
  private currentWalletRoles(
    participants: ContractParticipant[] = [],
  ): string[] {
    return this.contractsData.rolesForCandidates(
      participants,
      this.currentWalletRoleCandidates(),
    );
  }

  private currentWalletRoleCandidates(): string[] {
    const wallet = this.currentWallet();
    return [
      wallet?.getAddress(),
      this.currentWalletPubkey(),
      this.currentWalletPubkeyHash(),
    ]
      .filter((value): value is string => !!value)
      .map((value) => value.toLowerCase());
  }

  private extractDeadlineMs(
    summary: IndexerCovenantDetails,
    utxoState?: Record<string, any> | null,
  ): number | undefined {
    return this.contractsData.extractDeadlineMs(summary, utxoState);
  }

  private sortDashboardEntries(
    entries: ContractDashboardEntry[],
  ): ContractDashboardEntry[] {
    return this.contractsData.sortDashboardEntries(entries);
  }

  /**
   * @param options.silent Re-fetch and merge fresh data into an
   * already-displayed detail view (e.g. loadContracts() keeping an open
   * panel in sync after a background dashboard reload) without resetting
   * the loading flag or the interact-contract selection — both of which
   * would otherwise blank the "Available actions" panel and rebuild it,
   * flickering nothing -> actions a second time for data the user is
   * already looking at.
   * @param options.skipScrollToTop Callers that are about to scroll
   * somewhere else once loading finishes (e.g. openDashboardAction scrolling
   * to the action panel) should set this — otherwise the top-of-page scroll
   * queued here fires right before the caller's own scroll, producing a
   * visible snap-to-top-then-scroll-down jump.
   */
  async openContractDetail(
    entry: ContractDashboardEntry,
    options?: {
      silent?: boolean;
      skipScrollToTop?: boolean;
      autoSelectFunction?: boolean;
    },
  ) {
    const silent = options?.silent ?? false;
    const skipScrollToTop = options?.skipScrollToTop ?? false;
    // Only the dashboard's quick-action buttons (openDashboardAction) want to
    // land straight in a prefilled form. A plain "Details" open — or a
    // background refresh of an already-open one — should leave whichever
    // view/action the user is already on alone: auto-selecting a default here
    // can otherwise jump the user out from under a form they're mid-way
    // through (e.g. Keep Alive winning over a just-opened Claim form once a
    // slower-resolving indexer fallback catches up).
    const autoSelectFunction = options?.autoSelectFunction ?? false;
    const requestToken = ++this.detailRequestToken;
    const isCurrentRequest = () => requestToken === this.detailRequestToken;
    // Stays true across every background/route-driven call in the settling
    // window after an action (there can be several — the indexing poll keeps
    // refreshing until it catches up) — only an explicit user navigation
    // (navigateToContractDetail()/openDashboardAction()) clears it. See the
    // field's doc comment.
    const suppressAutoActionOpen = this.hideActionsAfterCompletion();

    if (!silent) {
      this.loadingRequestToken = requestToken;
      this.selectedDetailLoading.set(true);
      this.selectedDetail.set({
        entry: this.withDashboardName(entry),
        actions: [],
        utxos: [],
      });
      if (this.activeTab() === 'detail') {
        this.clearInteractContractSelection();
      }
      if (!skipScrollToTop) this.scrollContractsContentToTop();
    }
    this.selectedDetailError.set(null);
    this.dashboardError.set(null);

    const identifier = entry.covenantId || entry.scriptHash || entry.deployTxid;
    this.logContractsDebug('[Contracts][detail] Opening contract detail', {
      entryId: entry.id,
      contractName: entry.contractName,
      status: entry.status,
      identifier,
      covenantId: entry.covenantId,
      scriptHash: entry.scriptHash,
      deployTxid: entry.deployTxid,
      currentAddress: entry.currentAddress,
      hasRegistryEntry: !!entry.registryEntry,
      silent,
      requestToken,
    });
    if (!identifier) {
      console.warn(
        '[Contracts][detail] Cannot load detail: missing identifier',
        {
          entryId: entry.id,
          contractName: entry.contractName,
        },
      );
      if (!silent) {
        this.selectedDetailLoading.set(false);
        this.selectedDetailError.set(
          'This local contract has no indexer id or deploy transaction yet. Use the action flow or import by tx once indexed.',
        );
      }
      return;
    }

    try {
      const resolved = await this.fetchIndexerCovenant(identifier);
      const detailIdentifier =
        entry.covenantId ||
        entry.scriptHash ||
        resolved.covenant?.covenantIdHex ||
        resolved.covenant?.scriptHashHex;
      this.logContractsDebug('[Contracts][detail] Resolved indexer covenant', {
        requestedIdentifier: identifier,
        detailIdentifier,
        responseCovenantId: resolved.covenant?.covenantIdHex,
        responseScriptHash: resolved.covenant?.scriptHashHex,
        responseAddress: resolved.covenant?.address,
        responseActions: resolved.actions?.length ?? 0,
      });
      const [rawActions, rawUtxos] = detailIdentifier
        ? await Promise.all([
            this.covenantIndexerService.getCovenantActions(detailIdentifier),
            this.covenantIndexerService.getCovenantUtxos(detailIdentifier),
          ])
        : [resolved.actions, [] as IndexerCovenantUtxo[]];
      const actions = Array.isArray(rawActions) ? rawActions : [];
      const utxos = Array.isArray(rawUtxos) ? rawUtxos : [];
      const activeUtxos = utxos.filter((utxo) =>
        this.isActiveIndexerUtxo(utxo),
      );
      this.logContractsDebug(
        '[Contracts][detail] Loaded detail actions and UTXOs',
        {
          detailIdentifier,
          actionCount: actions.length,
          utxoCount: utxos.length,
          activeUtxoCount: activeUtxos.length,
          utxos: utxos.map((utxo) => ({
            txid: utxo.txidHex,
            vout: utxo.vout,
            address: utxo.address,
            amountSompi: utxo.amountSompi,
            status: utxo.status,
            covenantId: utxo.covenantIdHex,
            scriptHash: utxo.scriptHashHex,
          })),
        },
      );
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
        ? this.statusFromActiveUtxoCount(activeUtxos.length)
        : entry.status;
      const updatedEntry: ContractDashboardEntry = this.withDashboardName({
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
        deadlineMs: resolved.covenant
          ? this.extractDeadlineMs(resolved.covenant, utxos[0]?.state)
          : entry.deadlineMs,
        participants: this.mergeParticipants(
          entry.participants,
          resolved.covenant
            ? this.indexerParticipants(resolved.covenant)
            : undefined,
        ),
      });
      this.logContractsDebug(
        '[Contracts][detail] Updated detail entry from indexer',
        {
          entryId: updatedEntry.id,
          covenantId: updatedEntry.covenantId,
          scriptHash: updatedEntry.scriptHash,
          status: updatedEntry.status,
          amountSompi: updatedEntry.amountSompi,
          currentAddress: updatedEntry.currentAddress,
          deadlineMs: updatedEntry.deadlineMs,
          participants: updatedEntry.participants,
        },
      );
      if (!isCurrentRequest()) return;
      this.selectedDetail.set({
        entry: updatedEntry,
        response,
        actions,
        utxos,
      });
      if (
        this.activeTab() === 'detail' &&
        updatedEntry.status === 'active' &&
        !suppressAutoActionOpen
      ) {
        const prepared = await this.prepareDashboardAction(
          updatedEntry,
          requestToken,
          silent,
          autoSelectFunction,
        );
        this.logContractsDebug(
          '[Contracts][detail] prepareDashboardAction finished',
          {
            entryId: updatedEntry.id,
            prepared,
            selectedContractId: this.selectedContractId(),
            interactJsonLength: this.interactContractJson().length,
            availableFunctions: this.availableFunctions().map((fn) => fn.name),
          },
        );
        if (!isCurrentRequest()) return;
        await this.refreshDmsDeadlineFromScript(requestToken);
      } else {
        console.warn('[Contracts][detail] Action prep skipped', {
          entryId: updatedEntry.id,
          activeTab: this.activeTab(),
          status: updatedEntry.status,
        });
      }
    } catch (error: any) {
      if (!isCurrentRequest()) return;
      if (entry.registryEntry) {
        // The indexer may not have caught up yet (e.g. right after a fresh
        // deploy — see trackDeployIndexing()) or may be temporarily
        // unavailable. The local registry entry already has everything
        // needed to display this contract and prepare actions on it, so
        // fall back to that instead of hard-failing.
        console.warn(
          '[Contracts] Indexer detail lookup failed, falling back to local registry entry:',
          error,
        );
        this.selectedDetailError.set(
          "Indexer hasn't caught up with this contract yet — showing your locally saved copy. Try refreshing in a moment for live status.",
        );
        if (
          this.activeTab() === 'detail' &&
          entry.status === 'active' &&
          !suppressAutoActionOpen
        ) {
          await this.prepareDashboardAction(
            entry,
            requestToken,
            silent,
            autoSelectFunction,
          );
        }
      } else {
        this.selectedDetailError.set(
          error?.message || 'Failed to load indexer detail for this contract.',
        );
      }
    } finally {
      if (requestToken === this.loadingRequestToken && !silent) {
        this.selectedDetailLoading.set(false);
        if (!skipScrollToTop) this.scrollContractsContentToTop();
      }
    }
  }

  /**
   * The indexer's decoded deadline can lag behind the actual on-chain value
   * (e.g. right after a keepAlive, before the indexer reclassifies the new
   * continuation as a recognized template instance). The compiled contract's
   * script bytes are ground truth — it's the same source executeDmsKeepAlive()
   * validates the new deadline against — so once it's loaded, prefer it over
   * the indexer-derived guess used for the initial display.
   */
  private async refreshDmsDeadlineFromScript(requestToken: number) {
    const contract = this.parsedInteractContract();
    const detail = this.selectedDetail();
    if (!contract || !detail || contract.contract_name !== 'DeadManSwitch') {
      return;
    }
    const deadline = await this.extractTemplateIntField(
      contract,
      'dead-mans-switch',
      'initDeadline',
    );
    if (deadline === undefined) return;
    const deadlineMs = Number(deadline);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) return;
    if (requestToken !== this.detailRequestToken) return;
    this.selectedDetail.set({
      ...detail,
      entry: { ...detail.entry, deadlineMs },
    });
  }

  async openDashboardAction(entry: ContractDashboardEntry) {
    this.detailPanelTab.set('action');
    this.actionPageView.set('form');
    this.activeTab.set('detail');
    // A deliberate request to act — any suppression left over from an
    // earlier action's settling window no longer applies.
    this.hideActionsAfterCompletion.set(false);
    await this.openContractDetail(entry, {
      skipScrollToTop: true,
      autoSelectFunction: true,
    });
    this.scrollToActionPanel();
  }

  /**
   * Used by the "Available actions" list rendered inside an already-open
   * detail view — that data (and interactContractJson, which the action
   * panel needs to render) was already loaded when the detail view opened,
   * so unlike openDashboardAction() this never re-fetches from the indexer.
   * Re-fetching made the actions list flash to its loading skeleton
   * (selectedDetailLoading briefly true) and delayed the scroll behind a
   * full network round trip for data we already had.
   */
  async selectDetailAction(fnName?: string) {
    this.detailPanelTab.set('action');
    this.actionPageView.set('form');
    const detail = this.selectedDetail();
    if (detail) {
      const prepared = await this.prepareDetailInteractState(detail);
      if (!prepared) return;
    }
    if (fnName) {
      this.dashboardError.set(null);
      if (detail) this.userPickedFunctionForEntryId = detail.entry.id;
      this.pendingFunctionSelect.set({ fn: fnName });
    }
    this.scrollToActionPanel();
  }

  private async prepareDetailInteractState(
    detail: ContractDetailState,
  ): Promise<boolean> {
    const entry = detail.entry;
    if (entry.registryEntry) {
      const registryEntry =
        await this.syncRegistryEntryForDashboardAction(entry);
      this.selectedContractId.set(registryEntry.id);
      this.applySelectedRegistryContract(registryEntry.id);
      return true;
    }

    if (detail.response) {
      try {
        const actions =
          detail.actions.length > 0
            ? detail.actions
            : detail.response.actions || [];
        const action = actions[0];
        if (!action) {
          throw new Error(
            'No indexed covenant action is available for this contract.',
          );
        }
        const preview = await this.buildIndexerImportPreview({
          action,
          actions,
          covenant: detail.response.covenant,
          activeUtxo: detail.utxos.length === 1 ? detail.utxos[0] : null,
          currentAddress: detail.entry.currentAddress,
        });
        this.selectedContractId.set('');
        this.interactContractJson.set(preview.compiledJson);
        this.interactOutpointTxid = preview.outpoint.txid;
        this.interactOutpointVout = String(preview.outpoint.vout);
        this.interactInputAmount = preview.amountSompi;
        this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
        this.interactResolvedOutputAddress = null;
        return true;
      } catch (error: any) {
        this.dashboardError.set(
          error?.message || 'Failed to prepare this contract action.',
        );
        return false;
      }
    }

    return !!this.parsedInteractContract();
  }

  /**
   * The action form renders as a separate block below the whole detail view
   * (participants, UTXOs, timeline, etc.), so clicking an action button can
   * look like nothing happened unless we bring it into view.
   */
  private scrollToActionPanel() {
    if (!this.isBrowser) return;
    setTimeout(() => {
      const panel = document.getElementById('contract-action-panel');
      if (!panel) return;
      // scrollIntoView({block: 'start'}) aligns the panel with the
      // scroll container's true top, but .wrapper__header is sticky within
      // that same container — it stays pinned over whatever ends up there,
      // permanently covering the panel's title. scroll-margin-top tells
      // scrollIntoView to leave room for it, without us having to guess
      // which ancestor is the actual scroll container.
      const headerHeight =
        document.querySelector<HTMLElement>('.wrapper__header')?.offsetHeight ??
        0;
      panel.style.scrollMarginTop = `${headerHeight + 12}px`;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private async prepareDashboardAction(
    entry: ContractDashboardEntry,
    requestToken: number,
    silent = false,
    autoSelectFunction = false,
  ): Promise<boolean> {
    this.logContractsDebug('[Contracts][actions] Preparing dashboard action', {
      entryId: entry.id,
      contractName: entry.contractName,
      status: entry.status,
      covenantId: entry.covenantId,
      scriptHash: entry.scriptHash,
      deployTxid: entry.deployTxid,
      currentAddress: entry.currentAddress,
      hasRegistryEntry: !!entry.registryEntry,
      requestToken,
      silent,
    });
    if (entry.registryEntry) {
      const registryEntry =
        await this.syncRegistryEntryForDashboardAction(entry);
      if (requestToken !== this.detailRequestToken) return false;
      this.selectedContractId.set(registryEntry.id);
      this.applySelectedRegistryContract(registryEntry.id);
      if (!autoSelectFunction) return true;
      const hasEnabledDefault = this.selectDefaultFunctionForContract(entry);
      this.logContractsDebug(
        '[Contracts][actions] Prepared from registry entry',
        {
          entryId: entry.id,
          registryId: registryEntry.id,
          contractAddress: registryEntry.contractAddress,
          outpoint: registryEntry.outpoint,
          amountSompi: registryEntry.amountSompi,
          covenantId: registryEntry.covenantId,
          compiledJsonLength: registryEntry.compiledJson?.length,
          interactJsonLength: this.interactContractJson().length,
          availableFunctions: this.availableFunctions().map((fn) => fn.name),
          hasEnabledDefault,
          selectedFunction: this.selectedFunction,
        },
      );
      if (!silent && !hasEnabledDefault) {
        // openDashboardAction() optimistically opens straight to the action
        // form before this resolves. Nothing the current role/state can
        // actually submit was found, so land on the guarded action list
        // instead of a form for a function that isn't really available.
        this.detailPanelTab.set('action');
        this.actionPageView.set('list');
      }
      return true;
    }

    this.dashboardError.set(null);

    if (entry.status === 'tracking-incomplete') {
      console.warn(
        '[Contracts][actions] Cannot prepare action: tracking incomplete',
        {
          entryId: entry.id,
          covenantId: entry.covenantId,
          currentAddress: entry.currentAddress,
        },
      );
      this.dashboardError.set(
        'Actions are disabled because the indexer reports multiple active UTXOs for this covenant. Open details and choose a specific UTXO once the wallet supports UTXO selection.',
      );
      this.detailPanelTab.set('details');
      this.actionPageView.set('list');
      return false;
    }

    const identifier = entry.covenantId || entry.scriptHash || entry.deployTxid;
    if (!identifier) {
      console.warn(
        '[Contracts][actions] Cannot prepare action: missing identifier',
        {
          entryId: entry.id,
          contractName: entry.contractName,
        },
      );
      this.dashboardError.set(
        'This contract cannot be opened for actions until it has an indexer covenant id, script hash, or deploy transaction.',
      );
      return false;
    }

    try {
      if (!silent) {
        this.loadingRequestToken = requestToken;
        this.selectedDetailLoading.set(true);
      }
      const response = await this.fetchIndexerCovenant(identifier);
      const detail = this.selectedDetail();
      const preview = await this.buildIndexerImportPreview({
        ...response,
        activeUtxo: detail?.utxos.length === 1 ? detail.utxos[0] : null,
        currentAddress: entry.currentAddress,
      });
      this.logContractsDebug(
        '[Contracts][actions] Built indexer preview for action prep',
        {
          entryId: entry.id,
          identifier,
          previewCovenantId: preview.covenantId,
          previewAddress: preview.contractAddress,
          previewOutpoint: preview.outpoint,
          previewAmountSompi: preview.amountSompi,
          previewTemplate: preview.templateName,
          isLatestContinuation: preview.isLatestContinuation,
        },
      );
      if (requestToken !== this.detailRequestToken) return false;
      this.indexerImportPreview.set(preview);
      await this.importIndexerPreview({ stayOnCurrentTab: true });
      const imported = this.registryContracts().find(
        (contract) =>
          contract.network === this.network() &&
          this.isCurrentWalletRegistryEntry(contract) &&
          (this.sameIdentity(contract.covenantId, preview.covenantId) ||
            (this.sameIdentity(contract.outpoint.txid, preview.outpoint.txid) &&
              contract.outpoint.vout === preview.outpoint.vout)),
      );
      if (imported) {
        this.selectedContractId.set(imported.id);
        this.applySelectedRegistryContract(imported.id);
        const hasEnabledDefault = autoSelectFunction
          ? this.selectDefaultFunctionForContract(entry)
          : false;
        this.logContractsDebug(
          '[Contracts][actions] Imported preview selected for action',
          {
            importedId: imported.id,
            contractAddress: imported.contractAddress,
            outpoint: imported.outpoint,
            amountSompi: imported.amountSompi,
            covenantId: imported.covenantId,
            interactJsonLength: this.interactContractJson().length,
            availableFunctions: this.availableFunctions().map((fn) => fn.name),
            hasEnabledDefault,
            selectedFunction: this.selectedFunction,
          },
        );
        if (!silent) {
          this.activeTab.set('detail');
          this.detailPanelTab.set('action');
          if (autoSelectFunction) {
            this.actionPageView.set(hasEnabledDefault ? 'form' : 'list');
          }
        }
        return true;
      }
      console.warn(
        '[Contracts][actions] Preview imported but no matching registry contract was selected',
        {
          previewCovenantId: preview.covenantId,
          previewOutpoint: preview.outpoint,
          walletRegistryCount: this.registryContracts().length,
        },
      );
    } catch (error: any) {
      if (requestToken !== this.detailRequestToken) return false;
      console.warn('[Contracts][actions] Failed to prepare dashboard action', {
        entryId: entry.id,
        identifier,
        error,
      });
      this.dashboardError.set(
        error?.message || 'Import this contract before using wallet actions.',
      );
    } finally {
      if (requestToken === this.loadingRequestToken && !silent) {
        this.selectedDetailLoading.set(false);
      }
    }
    return false;
  }

  /**
   * detail.utxos comes from the indexer's getCovenantUtxos(), which can lag
   * behind a very recent local action the same way listCovenants() does (see
   * trackActionIndexing()). Trusting it blindly to move the registry's
   * outpoint can clobber a correct, fresher local outpoint with a stale,
   * already-spent one — the next spend then fails at broadcast time with
   * "Covenant outpoint ... was not found". Check live via RPC whether the
   * currently stored outpoint is still on-chain first; if it is, prefer it
   * (and its live amount) over the indexer's possibly-stale UTXO.
   */
  private async findLiveContractUtxo(
    registryEntry: ContractRegistryEntry,
  ): Promise<{ amountSompi: string } | undefined> {
    const rpc = this.rpcService.getRpc();
    if (!rpc) return undefined;
    try {
      const response = await rpc.getUtxosByAddresses({
        addresses: [registryEntry.contractAddress],
      });
      const utxos = response.entries || [];
      const found = utxos.find(
        (u: any) =>
          u.outpoint?.transactionId === registryEntry.outpoint.txid &&
          Number(u.outpoint?.index ?? -1) === registryEntry.outpoint.vout,
      );
      return found ? { amountSompi: found.amount.toString() } : undefined;
    } catch (err) {
      console.warn('[Contracts] Live outpoint check failed:', err);
      return undefined;
    }
  }

  private async syncRegistryEntryForDashboardAction(
    entry: ContractDashboardEntry,
  ): Promise<ContractRegistryEntry> {
    const cachedEntry = entry.registryEntry!;
    // entry.registryEntry is a snapshot from the last loadContracts()
    // dashboard build. A very recent action (e.g. a claim moments ago)
    // updates the registry store directly without necessarily rebuilding
    // that dashboard snapshot first — reading the stale copy here can
    // silently re-apply an already-superseded outpoint/amount, and the
    // "already past deploy" regression guard below only works if this
    // reflects what's actually persisted. Re-read the record fresh instead.
    const registryEntry =
      (await this.registryService.getContract(cachedEntry.id)) ?? cachedEntry;
    const liveUtxo = await this.findLiveContractUtxo(registryEntry);
    this.logContractsDebug(
      '[Contracts][registry] Syncing registry entry for action',
      {
        entryId: entry.id,
        registryId: registryEntry.id,
        registryAddress: registryEntry.contractAddress,
        registryOutpoint: registryEntry.outpoint,
        registryAmountSompi: registryEntry.amountSompi,
        entryCurrentAddress: entry.currentAddress,
        entryCovenantId: entry.covenantId,
        liveUtxo,
      },
    );

    // findLiveContractUtxo() awaits an RPC call, during which the user could
    // navigate to a different contract's detail view — re-check identity
    // before trusting selectedDetail().utxos, or a different contract's UTXO
    // could get applied to this registry entry.
    const detail = this.selectedDetail();
    const detailActiveUtxos = (detail?.utxos || []).filter((utxo) =>
      this.isActiveIndexerUtxo(utxo),
    );
    const indexerUtxo =
      !liveUtxo &&
      detail?.entry.id === entry.id &&
      detailActiveUtxos.length === 1
        ? detailActiveUtxos[0]
        : undefined;

    const amountSompi = String(
      liveUtxo?.amountSompi ??
        indexerUtxo?.amountSompi ??
        entry.amountSompi ??
        registryEntry.amountSompi,
    );
    const contractAddress =
      indexerUtxo?.address ||
      entry.currentAddress ||
      registryEntry.contractAddress;
    this.logContractsDebug(
      '[Contracts][registry] Registry sync source selection',
      {
        registryId: registryEntry.id,
        hasLiveUtxo: !!liveUtxo,
        indexerUtxo: indexerUtxo
          ? {
              txid: indexerUtxo.txidHex,
              vout: indexerUtxo.vout,
              address: indexerUtxo.address,
              amountSompi: indexerUtxo.amountSompi,
              status: indexerUtxo.status,
            }
          : null,
        selectedContractAddress: contractAddress,
        selectedAmountSompi: amountSompi,
      },
    );

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
    const walletKey = this.currentWalletAliasKey();
    if (walletKey && this.currentWalletRoles(entry.participants).length > 0) {
      updates.wallets = { ...(registryEntry.wallets || {}), [walletKey]: true };
    }

    if (indexerUtxo?.txidHex && indexerUtxo.vout !== undefined) {
      updates.outpoint = {
        txid: indexerUtxo.txidHex,
        vout: Number(indexerUtxo.vout),
      };
    }

    // liveUtxo already confirmed the *current* registry outpoint is still
    // unspent, straight from RPC. The indexer's own action/UTXO history can
    // lag well behind that (its actions list may still show only "deploy"
    // after a claim has already confirmed on-chain) — refreshing from it
    // here would silently clobber the verified-fresh outpoint/amount with a
    // stale, already-spent one, and the next spend would fail at broadcast
    // with "outpoint was not found". Nothing needs refreshing from the
    // indexer when the live check already vouches for what we have.
    if (!liveUtxo && detail?.entry.id === entry.id && detail.response) {
      try {
        const actions =
          detail.actions.length > 0
            ? detail.actions
            : detail.response.actions || [];
        const previewBaseAction =
          actions.find((action) => action.action === 'deploy') || actions[0];
        if (!previewBaseAction) {
          throw new Error(
            'No indexer action is available for preview refresh.',
          );
        }
        const preview = await this.buildIndexerImportPreview({
          action: previewBaseAction,
          actions,
          covenant: detail.response.covenant,
          activeUtxo: indexerUtxo || null,
          currentAddress: contractAddress,
        });
        // The indexer's action history can still only show "deploy" well
        // after a claim has already confirmed on-chain, in which case this
        // preview is built from the deploy action and its outpoint regresses
        // to the original (now long-spent) deploy outpoint. The registry
        // already having moved past deploy is proof this preview is stale —
        // applying it anyway would clobber a correct, fresher outpoint with
        // one the next spend can never find, permanently ("outpoint was not
        // found") until the indexer catches up.
        const registryAlreadyPastDeploy =
          registryEntry.outpoint.txid !== registryEntry.deployTxid;
        const previewRegressesToDeploy =
          preview.outpoint.txid === registryEntry.deployTxid;
        if (registryAlreadyPastDeploy && previewRegressesToDeploy) {
          this.logContractsDebug(
            '[Contracts][registry] Skipped stale preview refresh (would regress to deploy outpoint)',
            {
              registryId: registryEntry.id,
              registryOutpoint: registryEntry.outpoint,
              previewOutpoint: preview.outpoint,
            },
          );
        } else {
          const compiled = this.covenantService.parseCompiledContract(
            preview.compiledJson,
          );
          Object.assign(updates, {
            contractName: compiled.contract_name || registryEntry.contractName,
            compiledJson: preview.compiledJson,
            contractAddress: preview.contractAddress,
            outpoint: preview.outpoint,
            amountSompi: preview.amountSompi,
            status: 'active' as ContractStatus,
            accessRoles: this.parseAccessRoles(compiled),
            covenantId: preview.covenantId,
          });
          this.logContractsDebug(
            '[Contracts][registry] Refreshed registry artifact from preview',
            {
              registryId: registryEntry.id,
              previewAddress: preview.contractAddress,
              previewOutpoint: preview.outpoint,
              previewAmountSompi: preview.amountSompi,
              previewCovenantId: preview.covenantId,
              isLatestContinuation: preview.isLatestContinuation,
              compiledContractName: compiled.contract_name,
            },
          );
        }
      } catch (error) {
        console.warn(
          '[Contracts] Failed to refresh registry contract artifact from latest continuation:',
          error,
        );
      }
    }

    await this.updateRegistryContract(registryEntry.id, updates);
    const updatedEntry = { ...registryEntry, ...updates };
    this.logContractsDebug('[Contracts][registry] Registry entry after sync', {
      registryId: updatedEntry.id,
      contractAddress: updatedEntry.contractAddress,
      outpoint: updatedEntry.outpoint,
      amountSompi: updatedEntry.amountSompi,
      covenantId: updatedEntry.covenantId,
      status: updatedEntry.status,
      compiledJsonLength: updatedEntry.compiledJson?.length,
    });
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
    if (!this.isBrowser) return;
    setTimeout(() => {
      // .contracts-container itself has no overflow — it's not the actual
      // scroll region. The real scroll container is the app shell's
      // .wrapper__content (contracts always renders inside it; see
      // app-wrapper.component.scss). .flow-page-body is the other
      // possible scroll region, used when the wallet-action overlay is open.
      document
        .querySelector<HTMLElement>('.wrapper__content')
        ?.scrollTo({ top: 0, behavior: 'auto' });
      document
        .querySelector<HTMLElement>('.flow-page-body')
        ?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  navigateToContractDetail(entry: ContractDashboardEntry) {
    this.detailPanelTab.set('details');
    this.actionPageView.set('list');
    this.activeTab.set('detail');
    // A deliberate fresh navigation — any suppression left over from an
    // earlier action's settling window no longer applies.
    this.hideActionsAfterCompletion.set(false);
    void this.openContractDetail(entry);
  }

  backToContractsList() {
    this.selectedDetail.set(null);
    this.selectedDetailError.set(null);
    this.activeTab.set('my-contracts');
    // Leaving the detail view entirely — don't let suppression leak into
    // whichever contract's detail is opened next, and don't let any
    // transient state saved before this point (e.g. surfacing a co-signer
    // partial-spend dialog) get restored into the next destroy/recreate
    // cycle instead of the plain "My Contracts" list this is resetting to.
    this.hideActionsAfterCompletion.set(false);
    this.flowPagesService.saveTransientState('contracts', undefined);
    void this.loadContracts();
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
    return this.contractsData.sameIdentity(left, right);
  }

  private normalizeIdentity(value?: string): string {
    return this.contractsData.normalizeIdentity(value);
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
    this.interactIndexerState.set(null);
    this.partialSpendJson.set(null);
    this.partialCompleteError.set(null);
    this.partialCompleteResult.set(null);
  }

  /**
   * Populate the interact-state fields from a registry contract. Mirrors
   * ContractActionPanelComponent's own selectContractFromRegistry() (its
   * internal dropdown-select handler) — duplicated here because
   * openDashboardAction()/prepareDetailInteractState() need to do the same
   * lookup before the panel may even be mounted yet.
   */
  private applySelectedRegistryContract(contractId: string) {
    const contract = this.registryContracts().find((c) => c.id === contractId);
    if (!contract) return;
    this.interactContractJson.set(contract.compiledJson);
    this.interactOutpointTxid = contract.outpoint.txid;
    this.interactOutpointVout = contract.outpoint.vout.toString();
    this.interactInputAmount = contract.amountSompi;
    this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
    this.interactResolvedOutputAddress = null;
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
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked funds without withdrawing anything.',
        iconClass: 'icon-add',
      },
      changeHeir: {
        label: 'Change Heir',
        description: 'Update the wallet designated to inherit the funds.',
        iconClass: 'icon-user-gear',
        requiredRole: 'Owner',
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
      changeRecovery: {
        label: 'Change Recovery',
        description: 'Update the wallet allowed to recover after the timelock.',
        iconClass: 'icon-user-gear',
        requiredRole: 'Owner',
      },
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked funds without withdrawing anything.',
        iconClass: 'icon-add',
      },
    },
    MultiSigVault: {
      initiateWithdrawal: {
        label: 'Initiate Withdrawal',
        description:
          'Choose a co-signer, sign your part, and generate a partial spend JSON.',
        iconClass: 'icon-coins-02',
        extraGuard: (detail) =>
          this.requireOneOfRoles(detail, ['Signer 1', 'Signer 2', 'Signer 3']),
      },
      completePartial: {
        label: 'Complete Co-Signer Withdrawal',
        description:
          'Paste a partial withdrawal JSON from another signer, add your signature, and broadcast.',
        iconClass: 'icon-send-01',
        extraGuard: (detail) =>
          this.requireOneOfRoles(detail, ['Signer 1', 'Signer 2', 'Signer 3']),
      },
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked funds without withdrawing anything.',
        iconClass: 'icon-add',
      },
    },
    EscrowWithArbiter: {
      release: {
        label: 'Release',
        description:
          'Both buyer and seller agree to release funds to the recipient.',
        iconClass: 'icon-send-01',
        requiredRole: 'Buyer',
      },
      completePartial: {
        label: 'Complete Release Funds',
        description:
          'Seller: paste the buyer’s partial release JSON, add your signature, and broadcast.',
        iconClass: 'icon-send-01',
        requiredRole: 'Seller',
      },
      refund: {
        label: 'Refund',
        description: 'Cancel the escrow and return funds to the sender.',
        iconClass: 'icon-coins-02',
        requiredRole: 'Buyer',
      },
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked funds without withdrawing anything.',
        iconClass: 'icon-add',
      },
      arbitrate: {
        label: 'Arbitrate',
        description: 'Resolve the dispute as the trusted arbiter.',
        iconClass: 'icon-shield',
        requiredRole: 'Arbiter',
      },
    },
    SelfCustodyVault: {
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked vault without changing its phase.',
        iconClass: 'icon-add',
      },
      unvault: {
        label: 'Start Unvault',
        description:
          'Use the hot wallet to move the vault into the delayed unvaulting phase.',
        iconClass: 'icon-refresh-ccw-04',
        requiredRole: 'Hot wallet',
      },
      emergencySweep: {
        label: 'Emergency Sweep',
        description:
          'Use the cold wallet to sweep funds without waiting for the unvault delay.',
        iconClass: 'icon-shield',
        extraGuard: (detail) =>
          this.requireSelfCustodyRole(detail, 'Cold wallet'),
      },
      finalize: {
        label: 'Finalize',
        description:
          'Use the hot wallet to withdraw after the unvault delay has passed.',
        iconClass: 'icon-coins-02',
        requiredRole: 'Hot wallet',
      },
    },
  };

  /**
   * Whether every async source getAvailableActions() reads from has settled.
   * selectedDetailLoading() alone doesn't cover this: the current wallet
   * (used for role checks) resolves on its own schedule, independent of the
   * indexer/contract-detail fetch chain, and can flip currentWalletRoles()
   * from [] to the real roles after the actions panel has already rendered —
   * causing a disabled -> enabled flicker. Gate the panel on both settling
   * before rendering real enabled/disabled state.
   */
  actionsPanelReady = computed(() => {
    const detail = this.selectedDetail();
    if (this.selectedDetailLoading() || !detail || !this.currentWallet()) {
      return false;
    }
    if (detail.entry.status !== 'active') return true;

    const hasCuratedActions =
      !!this.actionMetaTable[
        this.normalizeContractName(detail.entry.contractName)
      ];
    if (!hasCuratedActions) return true;

    return (
      (!!this.parsedInteractContract() &&
        this.availableFunctions().length > 0) ||
      !!this.selectedDetailError() ||
      !!this.dashboardError()
    );
  });

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
    const availableNames =
      normalized === 'SelfCustodyVault'
        ? new Set(Object.keys(table))
        : new Set(available.map((fn) => fn.name));
    const currentRoles = this.currentWalletRolesForDetail(detail);
    const selfCustodyPhase = this.getSelfCustodyPhase(detail);
    const testMode = this.isTestModeEnabled();

    return Object.entries(table).map(([fnName, meta]) => {
      const existsOnChain =
        fnName === 'completePartial' ||
        fnName === 'initiateWithdrawal' ||
        availableNames.has(fnName);

      let disabledReason: string | null = null;
      if (testMode) {
        disabledReason = null;
      } else if (!existsOnChain) {
        disabledReason =
          available.length === 0
            ? 'Loading contract functions…'
            : 'Not available on this contract version.';
      } else if (
        meta.requiredRole &&
        !currentRoles.includes(meta.requiredRole)
      ) {
        disabledReason = `Only the ${meta.requiredRole.toLowerCase()} can do this.`;
      } else {
        disabledReason = this.getSelfCustodyPhaseDisabledReason(
          fnName,
          selfCustodyPhase,
        );
        if (!disabledReason) {
          disabledReason = meta.extraGuard?.(detail) ?? null;
        }
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

  private isTestModeEnabled(): boolean {
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem('testMode') === '1';
    } catch {
      return false;
    }
  }

  private currentWalletRolesForDetail(detail: ContractDetailState): string[] {
    const roles = new Set(this.currentWalletRoles(detail.entry.participants));
    if (
      this.normalizeContractName(detail.entry.contractName) !==
      'SelfCustodyVault'
    ) {
      return Array.from(roles);
    }

    try {
      const args = this.selfCustodyArgsForDetail(detail);
      const wallet = this.currentWallet();
      const candidates = [
        wallet?.getAddress(),
        this.currentWalletPubkey(),
        this.currentWalletPubkeyHash(),
      ]
        .filter((value): value is string => !!value)
        .map((value) => value.toLowerCase());

      if (args['hotKey'] && candidates.includes(args['hotKey'].toLowerCase())) {
        roles.add('Hot wallet');
      }
      if (
        args['coldKey'] &&
        candidates.includes(args['coldKey'].toLowerCase())
      ) {
        roles.add('Cold wallet');
      }
    } catch (error) {
      console.warn('[SelfCustodyVault] Failed to derive wallet role:', error);
    }

    return Array.from(roles);
  }

  private selfCustodyArgsForDetail(
    detail: ContractDetailState,
  ): Record<string, string> {
    const covenant = detail.response?.covenant || detail.entry.indexerSummary;
    const args: Record<string, string> = {
      ...this.templateService.argsArrayToRecord(
        this.normalizeIndexerArgs(covenant?.claimedArgs?.args),
      ),
      ...(covenant?.constructor
        ? Object.fromEntries(
            Object.entries(covenant.constructor).map(([key, value]) => [
              key,
              String(value),
            ]),
          )
        : {}),
    };

    const compiledJson = detail.entry.registryEntry?.compiledJson;
    if (compiledJson) {
      try {
        const compiled =
          this.covenantService.parseCompiledContract(compiledJson);
        Object.assign(
          args,
          this.templateService.argsArrayToRecord(
            this.normalizeIndexerArgs(compiled.tn10?.args),
          ),
        );
      } catch {
        /* keep indexer-derived args */
      }
    }

    return args;
  }

  private getSelfCustodyPhase(detail: ContractDetailState): number | undefined {
    if (
      this.normalizeContractName(detail.entry.contractName) !==
      'SelfCustodyVault'
    ) {
      return undefined;
    }

    const activeAction = this.getLatestCovenantOutputAction(detail.actions);
    const activeUtxo = detail.utxos.length === 1 ? detail.utxos[0] : undefined;
    const statePhase =
      activeUtxo?.state?.['initPhase'] ??
      activeUtxo?.state?.['phase'] ??
      activeAction?.outputs?.state?.['initPhase'] ??
      activeAction?.outputs?.state?.['phase'];
    const statePhaseNumber = Number(statePhase);
    if (Number.isFinite(statePhaseNumber)) return statePhaseNumber;

    const localArgs = this.localTemplateArgs(detail.entry.registryEntry);
    const localPhase = localArgs.find((arg) => arg.name === 'initPhase')?.value;
    const localPhaseNumber = Number(localPhase);
    return Number.isFinite(localPhaseNumber) ? localPhaseNumber : undefined;
  }

  private getSelfCustodyPhaseDisabledReason(
    fnName: string,
    phase: number | undefined,
  ): string | null {
    if (phase === undefined) return null;
    if (fnName === 'unvault' && phase !== 0) {
      return 'Only available while initPhase is 0 (locked).';
    }
    if (fnName === 'finalize' && phase !== 1) {
      return 'Only available while initPhase is 1 (unvaulting).';
    }
    if (fnName === 'topUp' && phase !== 0) {
      return 'Top up is only available while initPhase is 0 (locked).';
    }
    return null;
  }

  /** Disables a MultiSig spend action unless the current wallet is one of its required signer pair. */
  private requireOneOfSigners(
    detail: ContractDetailState,
    signerA: string,
    signerB: string,
  ): string | null {
    return this.requireOneOfRoles(detail, [signerA, signerB]);
  }

  private requireOneOfRoles(
    detail: ContractDetailState,
    rolesToAllow: string[],
  ): string | null {
    const roles = this.currentWalletRoles(detail.entry.participants);
    if (!rolesToAllow.some((role) => roles.includes(role))) {
      return `Only ${rolesToAllow.join(' or ')} can do this.`;
    }
    return null;
  }

  private requireSelfCustodyRole(
    detail: ContractDetailState,
    role: 'Hot wallet' | 'Cold wallet',
  ): string | null {
    const roles = this.currentWalletRolesForDetail(detail);
    if (!roles.includes(role)) {
      return `Only the ${role.toLowerCase()} can do this.`;
    }
    return null;
  }

  /**
   * Picks which entrypoint the action form defaults to. Ordering alone is not
   * enough; choose only actions that are enabled for this wallet and state.
   */
  private selectDefaultFunctionForContract(
    entry: ContractDashboardEntry,
  ): boolean {
    if (
      this.actionPageView() === 'form' &&
      this.selectedFunction &&
      this.userPickedFunctionForEntryId === entry.id
    ) {
      return true;
    }

    const normalized = this.normalizeContractName(entry.contractName);
    const selectedDetail = this.selectedDetail();
    const detailForEntry =
      selectedDetail?.entry.id === entry.id
        ? selectedDetail
        : { entry, actions: [], utxos: [] };
    const currentRoles = this.currentWalletRolesForDetail(detailForEntry);
    const preferredOrders: Record<string, string[]> = {
      DeadManSwitch: currentRoles.includes('Owner')
        ? ['keepAlive', 'changeHeir', 'topUp', 'claim']
        : ['claim', 'keepAlive', 'changeHeir', 'topUp'],
      TimeLockVault: currentRoles.includes('Recovery')
        ? ['recover', 'spend', 'changeRecovery', 'topUp']
        : ['spend', 'changeRecovery', 'recover', 'topUp'],
      MultiSigVault: ['initiateWithdrawal', 'completePartial', 'topUp'],
      EscrowWithArbiter: currentRoles.includes('Arbiter')
        ? ['arbitrate', 'release', 'refund', 'topUp']
        : currentRoles.includes('Seller')
          ? ['completePartial', 'release', 'refund', 'arbitrate', 'topUp']
          : ['release', 'refund', 'arbitrate', 'topUp'],
      SelfCustodyVault: currentRoles.includes('Cold wallet')
        ? ['emergencySweep', 'unvault', 'finalize', 'topUp']
        : ['unvault', 'finalize', 'topUp', 'emergencySweep'],
    };

    const actions = this.getAvailableActions(detailForEntry);
    const enabledNames = new Set(
      actions.filter((action) => action.enabled).map((action) => action.fnName),
    );
    const order = preferredOrders[normalized] || [];
    const target =
      order.find((name) => enabledNames.has(name)) ||
      actions.find((action) => action.enabled)?.fnName;
    if (!target) return false;
    this.pendingFunctionSelect.set({ fn: target });
    return true;
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
        'Enter a covenant ID, script hash, transaction ID, or contract address.',
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

  async importIndexerPreview(options: { stayOnCurrentTab?: boolean } = {}) {
    const preview = this.indexerImportPreview();
    if (!preview) {
      this.indexerImportError.set('Look up a covenant before importing it.');
      return;
    }
    if (!this.isActiveIndexerUtxo(preview.activeUtxo)) {
      this.indexerImportError.set(
        'This covenant has no single active UTXO to import. It may already be spent, or the indexer returned an ambiguous active set.',
      );
      return;
    }

    const existing = this.findSavedRegistryEntryForIdentity({
      covenantId: preview.covenantId,
      deployTxid: preview.deployTxid,
      outpoint: preview.outpoint,
    });
    if (existing) {
      const wasVisibleToCurrentWallet =
        this.isCurrentWalletRegistryEntry(existing);
      const walletKey = this.currentWalletAliasKey();
      const compiled = this.covenantService.parseCompiledContract(
        preview.compiledJson,
      );
      this.logContractsDebug(
        '[Contracts][registry] Import preview matched existing registry entry',
        {
          existingId: existing.id,
          existingAddress: existing.contractAddress,
          existingOutpoint: existing.outpoint,
          existingAmountSompi: existing.amountSompi,
          existingCovenantId: existing.covenantId,
          previewAddress: preview.contractAddress,
          previewOutpoint: preview.outpoint,
          previewAmountSompi: preview.amountSompi,
          previewCovenantId: preview.covenantId,
          wasVisibleToCurrentWallet,
        },
      );
      await this.updateRegistryContract(existing.id, {
        contractName: compiled.contract_name || existing.contractName,
        compiledJson: preview.compiledJson,
        deployTxid: existing.deployTxid || preview.deployTxid,
        contractAddress: preview.contractAddress,
        outpoint: preview.outpoint,
        amountSompi: preview.amountSompi,
        status: 'active',
        spendTxid: undefined,
        lastChecked: Date.now(),
        accessRoles: this.parseAccessRoles(compiled),
        covenantId: preview.covenantId,
        wallets: walletKey
          ? { ...(existing.wallets || {}), [walletKey]: true }
          : existing.wallets,
      });
      this.indexerImportPreview.set(null);
      this.indexerImportQuery = '';
      if (wasVisibleToCurrentWallet && !options.stayOnCurrentTab) {
        this.indexerImportError.set(
          'This covenant is already in My Contracts.',
        );
      } else {
        this.indexerImportError.set(null);
      }
      if (!options.stayOnCurrentTab) {
        this.activeTab.set('my-contracts');
      }
      await this.loadContracts();
      return;
    }

    const wallet = this.currentWallet();
    const walletKey = this.currentWalletAliasKey();
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
      wallets: walletKey ? { [walletKey]: true } : undefined,
    };

    await this.registryService.addContract(entry);
    this.allRegistryContracts.set([...this.allRegistryContracts(), entry]);
    this.registryContracts.set([...this.registryContracts(), entry]);
    this.indexerImportQuery = '';
    this.indexerImportPreview.set(null);
    if (!options.stayOnCurrentTab) {
      this.activeTab.set('my-contracts');
    }
    await this.loadContracts();
  }

  private statusFromActiveUtxoCount(
    activeUtxos: number | undefined,
  ): ContractDashboardEntry['status'] {
    return this.contractsData.statusFromActiveUtxoCount(activeUtxos);
  }

  private async fetchIndexerCovenant(identifier: string): Promise<{
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
  }> {
    return this.contractsData.fetchIndexerCovenant(identifier);
  }

  private async fetchIndexerCovenantByIdOrHash(
    identifier: string,
  ): Promise<IndexerCovenantResponse> {
    return this.contractsData.fetchIndexerCovenantByIdOrHash(identifier);
  }

  private async buildIndexerImportPreview(response: {
    action: IndexerCovenantAction;
    actions: IndexerCovenantAction[];
    covenant?: IndexerCovenantDetails;
    activeUtxo?: IndexerCovenantUtxo | null;
    currentAddress?: string | null;
  }): Promise<IndexerImportPreview> {
    const { action, actions, covenant } = response;
    let activeUtxo = this.isActiveIndexerUtxo(response.activeUtxo)
      ? response.activeUtxo
      : null;
    const latestContinuationAction = this.getLatestContinuationAction(actions);
    const latestOutputAction =
      latestContinuationAction ||
      this.getLatestCovenantOutputAction(actions) ||
      action;
    const covenantId = covenant?.covenantIdHex || action.covenantIdHex;
    this.logContractsDebug(
      '[Contracts][preview] Building indexer import preview',
      {
        actionCount: actions.length,
        baseAction: action.action,
        baseActionTxid: action.txidHex,
        covenantId,
        covenantAddress: covenant?.address,
        latestContinuationTxid: latestContinuationAction?.txidHex,
        latestContinuationAddress: latestContinuationAction?.outputs?.address,
        latestOutputActionType: latestOutputAction.action,
        latestOutputAddress: latestOutputAction.outputs?.address,
        providedActiveUtxo: response.activeUtxo
          ? {
              txid: response.activeUtxo.txidHex,
              vout: response.activeUtxo.vout,
              address: response.activeUtxo.address,
              amountSompi: response.activeUtxo.amountSompi,
              status: response.activeUtxo.status,
            }
          : null,
        providedCurrentAddress: response.currentAddress,
      },
    );

    if (!activeUtxo) {
      activeUtxo = await this.fetchSingleActiveIndexerUtxo([
        covenantId,
        latestOutputAction.covenantIdHex,
        this.extractScriptHashFromScriptPubKey(
          latestOutputAction.outputs?.scriptPubKeyHex,
        ),
        latestOutputAction.scriptHashHex,
      ]);
    }
    if (!activeUtxo) {
      throw new Error(
        'This covenant has no single active UTXO to import. It may already be spent, or the indexer returned an ambiguous active set.',
      );
    }

    const activeAction = this.mergeActiveUtxoIntoAction(
      latestOutputAction,
      activeUtxo,
    );
    const deployTxid =
      activeUtxo?.txidHex ||
      activeAction.txidHex ||
      covenant?.genesisTxidHex ||
      action.txidHex;
    const initialOutputAddress = latestContinuationAction
      ? undefined
      : action.outputs?.address;
    const contractAddress =
      activeUtxo?.address ||
      activeAction.outputs?.address ||
      covenant?.address ||
      response.currentAddress ||
      initialOutputAddress;
    const amountSompi = String(
      activeUtxo?.amountSompi ??
        activeAction.outputs?.amountSompi ??
        covenant?.totalAmountSompi ??
        action.outputs?.amountSompi ??
        '',
    );
    const vout = Number(
      activeUtxo?.vout ??
        activeAction.outputs?.vout ??
        action.outputs?.vout ??
        0,
    );
    const latestContinuationClaim =
      latestContinuationAction?.decodedArgs &&
      typeof latestContinuationAction.decodedArgs === 'object'
        ? latestContinuationAction.decodedArgs
        : undefined;
    const templateName =
      latestContinuationClaim?.['tmpl'] ||
      covenant?.claimedTemplate ||
      covenant?.claimedArgs?.tmpl;
    const args = this.normalizeIndexerArgs(
      latestContinuationClaim?.['args'] || covenant?.claimedArgs?.args,
    );

    this.logContractsDebug('[Contracts][preview] Preview source selection', {
      covenantId,
      deployTxid,
      contractAddress,
      amountSompi,
      vout,
      activeUtxo: activeUtxo
        ? {
            txid: activeUtxo.txidHex,
            vout: activeUtxo.vout,
            address: activeUtxo.address,
            amountSompi: activeUtxo.amountSompi,
            status: activeUtxo.status,
            covenantId: activeUtxo.covenantIdHex,
            scriptHash: activeUtxo.scriptHashHex,
          }
        : null,
      usedLatestContinuation: !!latestContinuationAction,
      templateName,
      argNames: args.map((arg) => arg.name),
      ignoredHistoricalActionAddress: action.address,
      ignoredHistoricalLatestOutputTopLevelAddress: latestOutputAction.address,
      initialOutputAddressFallback: initialOutputAddress,
    });

    if (!covenantId || !deployTxid || !contractAddress || !amountSompi) {
      console.warn('[Contracts][preview] Missing required preview fields', {
        covenantId,
        deployTxid,
        contractAddress,
        amountSompi,
        activeUtxo,
        covenant,
        action,
      });
      throw new Error(
        'Indexer response is missing covenant id, deploy transaction, address, or amount.',
      );
    }
    if (!templateName || args.length === 0) {
      console.warn('[Contracts][preview] Missing template claim', {
        covenantId,
        templateName,
        argsLength: args.length,
        latestContinuationDecodedArgs: latestContinuationAction?.decodedArgs,
        claimedTemplate: covenant?.claimedTemplate,
        claimedArgs: covenant?.claimedArgs,
      });
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

    let fieldValues = this.indexerArgsToTemplateValues(
      template,
      args,
      activeAction,
    );
    let compiled = await this.compileTemplateWithFieldValues(
      template,
      fieldValues,
    );
    const normalizedTemplateName = this.normalizeContractName(templateName);
    compiled.tn10 = {
      v: 1,
      tmpl: normalizedTemplateName,
      args:
        template.id === 'self-custody-vault'
          ? this.templateService.buildSelfCustodyArgsPayload(fieldValues)
          : args,
    };
    if (template.id === 'self-custody-vault') {
      this.templateService.logSelfCustodyContractParams(
        'indexer import compile',
        {
          fieldValues,
          tn10: compiled.tn10,
          activeState: activeAction?.outputs?.state,
          activeUtxoState: activeUtxo?.state,
          scriptLength: compiled.script?.length,
          address: this.covenantService.getContractAddress(compiled),
        },
      );
    }
    let computedAddress = this.covenantService.getContractAddress(compiled);
    if (
      template.id === 'self-custody-vault' &&
      contractAddress &&
      computedAddress !== contractAddress
    ) {
      const matched = await this.trySelfCustodyIndexerVariants(
        template,
        fieldValues,
        activeAction,
        contractAddress,
      );
      if (matched) {
        fieldValues = matched.fieldValues;
        compiled = matched.compiled;
        compiled.tn10 = {
          v: 1,
          tmpl: normalizedTemplateName,
          args: this.templateService.buildSelfCustodyArgsPayload(fieldValues),
        };
        computedAddress = matched.address;
      }
    }
    const isLatestContinuation =
      !!activeAction.outputs?.address &&
      activeAction.outputs.address !== computedAddress;
    if (computedAddress !== contractAddress) {
      if (template.id === 'self-custody-vault') {
        console.warn('[SelfCustodyVault] indexer import address mismatch', {
          computedAddress,
          contractAddress,
          activeUtxo,
          activeAction,
          fieldValues,
        });
      }
      console.warn('[Contracts][preview] Compiled contract address mismatch', {
        templateName,
        computedAddress,
        selectedContractAddress: contractAddress,
        latestContinuationAddress: latestContinuationAction?.outputs?.address,
        activeUtxoAddress: activeUtxo?.address,
        covenantAddress: covenant?.address,
        fieldValues,
        isLatestContinuation,
      });
      throw new Error(
        "This covenant's constructor args (e.g. a check-in deadline updated by a later keepAlive) do not match its current on-chain address — the indexer only decoded an earlier state and has no way to know the latest one. " +
          'If you know the current values (ask whoever last kept this contract alive), use "Advanced: paste contract JSON" in the Interact tab to build and sign the transaction manually.',
      );
    }

    return {
      action,
      activeAction,
      activeUtxo,
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
    return this.contractsData.getLatestCovenantOutputAction(actions);
  }

  private getLatestContinuationAction(
    actions: IndexerCovenantAction[],
  ): IndexerCovenantAction | undefined {
    return actions
      .filter(
        (action) =>
          action.action === 'continuation' &&
          !!action.outputs?.address &&
          !!action.decodedArgs,
      )
      .sort((a, b) => (b.blockTimeMs || 0) - (a.blockTimeMs || 0))[0];
  }

  private mergeActiveUtxoIntoAction(
    action: IndexerCovenantAction,
    activeUtxo?: IndexerCovenantUtxo | null,
  ): IndexerCovenantAction {
    if (!activeUtxo) return action;
    return {
      ...action,
      // Preserve the action's historical top-level address. Current-address
      // consumers must use outputs.address after this merge.
      covenantIdHex: activeUtxo.covenantIdHex || action.covenantIdHex,
      scriptHashHex: activeUtxo.scriptHashHex || action.scriptHashHex,
      txidHex: activeUtxo.txidHex || action.txidHex,
      outputs: {
        ...(action.outputs || {}),
        address: activeUtxo.address || action.outputs?.address,
        amountSompi: activeUtxo.amountSompi ?? action.outputs?.amountSompi,
        state: activeUtxo.state ?? action.outputs?.state,
        vout: activeUtxo.vout ?? action.outputs?.vout,
      },
    };
  }

  private async trySelfCustodyIndexerVariants(
    template: ContractTemplate,
    baseFieldValues: Record<string, string>,
    activeAction: IndexerCovenantAction,
    contractAddress: string,
  ): Promise<{
    fieldValues: Record<string, string>;
    compiled: CompiledContract;
    address: string;
  } | null> {
    const state = activeAction.outputs?.state || {};
    const phaseCandidates = this.uniqueStrings([
      state['initPhase'],
      state['phase'],
      baseFieldValues['initPhase'],
      '0',
      '1',
    ]);
    const delayCandidates = this.uniqueStrings([
      String(state['vaultUnvaultDelaySeconds'] ?? ''),
      String(state['unvaultDelaySeconds'] ?? ''),
      baseFieldValues['unvaultDelaySeconds'],
      String(state['vaultUnvaultDelaySeconds'] ?? ''),
      String(state['unvaultDelaySeconds'] ?? ''),
    ]);

    for (const initPhase of phaseCandidates) {
      for (const unvaultDelaySeconds of delayCandidates) {
        const fieldValues = {
          ...baseFieldValues,
          initPhase,
          unvaultDelaySeconds,
        };
        try {
          const compiled = await this.compileTemplateWithFieldValues(
            template,
            fieldValues,
          );
          const address = this.covenantService.getContractAddress(compiled);
          if (address === contractAddress) {
            this.templateService.logSelfCustodyContractParams(
              'indexer variant matched',
              {
                fieldValues,
                activeState: state,
                address,
              },
            );
            return { fieldValues, compiled, address };
          }
        } catch {
          /* Try the next candidate combination. */
        }
      }
    }

    return null;
  }

  private uniqueStrings(values: unknown[]): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => String(value ?? '').trim())
          .filter((value) => value !== ''),
      ),
    );
  }

  private isActiveIndexerUtxo(
    utxo?: IndexerCovenantUtxo | null,
  ): utxo is IndexerCovenantUtxo {
    return !!utxo && utxo.status !== 'spent' && !utxo.spentByTxidHex;
  }

  private async fetchSingleActiveIndexerUtxo(
    identifiers: Array<string | undefined | null>,
  ): Promise<IndexerCovenantUtxo | null> {
    const uniqueIdentifiers = Array.from(
      new Set(
        identifiers
          .map((identifier) => identifier?.trim())
          .filter((identifier): identifier is string => !!identifier),
      ),
    );
    this.logContractsDebug(
      '[Contracts][utxo] Looking for single active indexer UTXO',
      {
        identifiers: uniqueIdentifiers,
      },
    );

    for (const identifier of uniqueIdentifiers) {
      try {
        const utxos =
          await this.covenantIndexerService.getCovenantUtxos(identifier);
        const activeUtxos = utxos.filter((utxo) =>
          this.isActiveIndexerUtxo(utxo),
        );
        this.logContractsDebug('[Contracts][utxo] UTXO lookup result', {
          identifier,
          totalCount: utxos.length,
          activeCount: activeUtxos.length,
          activeUtxos: activeUtxos.map((utxo) => ({
            txid: utxo.txidHex,
            vout: utxo.vout,
            address: utxo.address,
            amountSompi: utxo.amountSompi,
            status: utxo.status,
            spentByTxid: utxo.spentByTxidHex,
            covenantId: utxo.covenantIdHex,
            scriptHash: utxo.scriptHashHex,
          })),
        });
        if (activeUtxos.length > 1) return null;
        if (activeUtxos.length === 1) return activeUtxos[0];
      } catch (error) {
        console.warn('[Contracts] Failed to fetch covenant UTXO:', {
          identifier,
          error,
        });
      }
    }

    console.warn('[Contracts][utxo] No single active indexer UTXO found', {
      identifiers: uniqueIdentifiers,
    });
    return null;
  }

  private extractScriptHashFromScriptPubKey(
    scriptPubKeyHex: string | undefined,
  ): string | undefined {
    return this.contractsData.extractScriptHashFromScriptPubKey(
      scriptPubKeyHex,
    );
  }

  private templateForIndexerName(
    templateName: string,
  ): ContractTemplate | undefined {
    return this.templateService.templateForIndexerName(templateName);
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
      return this.templateService.templateById('dead-mans-switch');
    }
    if (
      names.has('signer') &&
      names.has('recoveryKey') &&
      names.has('unlockBlueScore')
    ) {
      return this.templateService.templateById('time-lock-vault');
    }
    if (names.has('signer1') && names.has('signer2') && names.has('signer3')) {
      return this.templateService.templateById('multi-sig-vault');
    }
    if (names.has('buyer') && names.has('seller') && names.has('arbiter')) {
      return this.templateService.templateById('escrow-with-arbiter');
    }
    if (names.has('hotKey') && names.has('coldKey')) {
      return this.templateService.templateById('self-custody-vault');
    }
    return undefined;
  }

  private indexerArgsToTemplateValues(
    template: ContractTemplate,
    args: IndexerCovenantArg[],
    activeAction?: IndexerCovenantAction,
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
            byName.get('checkInDeadline') ??
            byName.get('deadline') ??
            byName.get('initDeadline') ??
            byName.get('inactivityPeriodDays') ??
            byName.get('inactivityPeriod') ??
            requireArg('checkInDeadline'),
        };
      case 'self-custody-vault':
        const state = activeAction?.outputs?.state || {};
        const delaySeconds = Number(
          state['vaultUnvaultDelaySeconds'] ??
            byName.get('unvaultDelaySeconds') ??
            requireArg('unvaultDelaySeconds'),
        );
        const whitelistedDestinations =
          byName.get('whitelistedDestinations') ?? '';
        return {
          hotKey: requireArg('hotKey'),
          coldKey: requireArg('coldKey'),
          whitelistedDestinations,
          whitelistedDestinations_mode:
            byName.get('whitelistMode') === 'whitelist'
              ? 'whitelist'
              : whitelistedDestinations
                ? 'whitelist'
                : 'anywhere',
          unvaultDelaySeconds: String(
            Number.isFinite(delaySeconds)
              ? delaySeconds
              : this.templateService.hoursToDaaDelay(24),
          ),
          initPhase: String(
            state['initPhase'] ??
              state['phase'] ??
              byName.get('initPhase') ??
              '0',
          ),
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
      this.templateService.fieldToCtorArgFromValues(field, fieldValues),
    );
    const { compiled, descriptor } =
      await this.templateService.getTemplatePatchContext(template.id);
    const patched = this.templatePatcher.applyPatch(
      compiled,
      descriptor,
      newArgs,
    ) as CompiledContract;
    if (template.id === 'self-custody-vault') {
      this.templateService.logSelfCustodyContractParams('template compile', {
        fieldValues,
        constructorArgs: newArgs,
        scriptLength: patched.script?.length,
        address: this.covenantService.getContractAddress(patched),
      });
    }
    return patched;
  }

  private async extractTemplateIntField(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<bigint | undefined> {
    return this.templateService.extractTemplateIntField(
      compiled,
      templateId,
      paramName,
    );
  }

  private async extractTemplatePubkeyHex(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<string | undefined> {
    return this.templateService.extractTemplatePubkeyHex(
      compiled,
      templateId,
      paramName,
    );
  }

  private async extractTemplateParamHex(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
    paramType: TemplatePatch['params'][number]['paramType'],
  ): Promise<string | undefined> {
    return this.templateService.extractTemplateParamHex(
      compiled,
      templateId,
      paramName,
      paramType,
    );
  }

  /**
   * Delete a contract from registry
   */
  async deleteContract(id: string) {
    await this.registryService.deleteContract(id);
    await this.loadContracts();
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
   * Applies a registry-entry patch emitted by a child component (deploy
   * form, action panel) that doesn't own allRegistryContracts/registryContracts
   * itself.
   */
  // Arrow-function fields, not methods: passed into ContractActionPanelComponent
  // as callback inputs (see its registryEntryUpdated/actionIndexingRequested
  // doc comments) rather than listened to via an output() template binding,
  // since that binding is torn down the instant the approval overlay
  // destroys this component — well before a covenant action's post-signing
  // continuation runs. A lexically-bound arrow field keeps working
  // regardless, the same way the pre-split monolith's own `this.foo(...)`
  // calls did.
  onRegistryEntryUpdated = (event: {
    id: string;
    updates: Partial<ContractRegistryEntry>;
  }) => {
    void this.updateRegistryContract(event.id, event.updates);
  };

  onActionIndexingRequested = (event: { txid: string; registryId: string }) => {
    this.markActionCompleteForDetailsLanding(event.registryId);
    void this.trackActionIndexing(event.txid, event.registryId);
  };

  // Same reasoning — see onActionIndexingRequested's doc comment.
  readonly backToContractsListCallback = () => this.backToContractsList();

  /**
   * Poll the indexer for a non-deploy covenant action (TopUp, withdraw,
   * keepAlive, changeHeir, partial-spend completion, etc.) and only settle
   * "My Contracts" once the merged dashboard entry's amount/status agrees
   * with what we already applied to the local registry.
   *
   * getTransactionSettlementStatus() alone isn't enough: it can report
   * `indexed: true` (the tx was seen) while the separate listCovenants()
   * listing that mergeDashboardEntries() trusts as the source of truth for
   * status/amount still lags behind — calling loadContracts() at that point
   * re-overwrites our optimistic registry update with the listing's stale
   * (pre-tx) values, the exact staleness this method exists to avoid. We
   * can't compare txids to detect that lag: mergeDashboardEntries() takes
   * `latestTxid` from the indexer entry, and indexerSummaryToDashboard()
   * always sets that to the covenant's genesis/deploy txid (there's no
   * "latest action txid" in the indexer's summary payload), so it would
   * never match a post-deploy action's txid even once the listing is fresh.
   * Comparing amount/status against the local entry sidesteps that.
   */
  private async trackActionIndexing(
    txid: string,
    registryEntryId?: string,
  ): Promise<void> {
    let resolveCompletion!: () => void;
    const completion = new Promise<void>(
      (resolve) => (resolveCompletion = resolve),
    );
    this.approvalFlowService.setActionIndexingCompletion(completion);
    try {
      await this.trackActionIndexingCore(txid, registryEntryId);
    } finally {
      resolveCompletion();
      this.approvalFlowService.clearActionIndexingCompletion(completion);
    }
  }

  private async trackActionIndexingCore(
    txid: string,
    registryEntryId?: string,
  ): Promise<void> {
    this.setActionIndexerState({
      txid,
      status: 'checking',
      message: 'Waiting for the indexer to see this transaction...',
    });

    let seenSettled = false;

    for (let attempt = 1; attempt <= 8; attempt++) {
      if (this.bailIfLeftContractsFlow()) return;
      try {
        if (!seenSettled) {
          const status =
            await this.covenantIndexerService.getTransactionSettlementStatus(
              txid,
            );
          if (this.bailIfLeftContractsFlow()) return;
          seenSettled = status.indexed;
        }

        if (seenSettled) {
          await this.loadContracts({ skipOnChainStatusRefresh: true });
          if (this.bailIfLeftContractsFlow()) return;
          if (this.dashboardCaughtUpWithLocal(registryEntryId)) {
            this.setActionIndexerState({
              txid,
              status: 'indexed',
              message: 'Indexed. My Contracts now reflects this change.',
            });
            return;
          }
          this.setActionIndexerState({
            txid,
            status: 'checking',
            message: 'Transaction confirmed — waiting for confirmation...',
          });
        } else {
          this.setActionIndexerState({
            txid,
            status: 'checking',
            message: 'Waiting for confirmation...',
          });
        }
      } catch (error: any) {
        console.warn('[Contracts] Action indexing check failed:', error);
        this.setActionIndexerState({
          txid,
          status: 'unavailable',
          message:
            error?.message ||
            'Indexer status is unavailable. The transaction was still broadcast.',
        });
        return;
      }

      await this.delay(2500);
      if (this.bailIfLeftContractsFlow()) return;
    }

    this.setActionIndexerState({
      txid,
      status: 'not-indexed',
      message:
        'Broadcast, but My Contracts may not reflect this change yet. Refresh in a moment.',
    });
  }

  /**
   * Call right after a covenant action succeeds — see
   * hideActionsAfterCompletion's and pendingLandOnContractId's doc comments
   * for what this does and why. `registryEntryId` is the acted-on contract
   * (this.selectedContractId() at the call site) — omit it if there's no
   * local registry entry to land back on.
   *
   * Also flips detailPanelTab/actionPageView back to the plain details view
   * directly on `this`, not just via the transient state the flow-page
   * hosting mode restores into a fresh instance. When this component is
   * router-hosted (see `destroyed`'s doc comment) it's never torn down by
   * the approval overlay, so this same instance is what the user sees
   * again — without this, it would still be sitting on whatever action
   * form (e.g. "Claim") they just submitted.
   */
  private markActionCompleteForDetailsLanding(registryEntryId?: string): void {
    this.hideActionsAfterCompletion.set(true);
    this.detailPanelTab.set('details');
    this.actionPageView.set('list');
    this.flowPagesService.saveTransientState('contracts', {
      hideActionsAfterCompletion: true,
      landOnContractId: registryEntryId || undefined,
    } satisfies ContractsTransientState);
  }

  /**
   * The flow-page outlet actually destroys ContractsPageComponent the
   * instant the approval success screen is layered on top of it (see
   * isContractsWide's comment in app-wrapper.component.ts) — it does NOT
   * stay mounted behind the overlay. Bailing on that destruction, as this
   * used to do via a component-local `destroyed` flag, made trackActionIndexing()
   * abandon the poll (and flush pendingConfirmation to 'unavailable')
   * immediately after every covenant action, before the indexer had any
   * chance to catch up — the success page's "Done" button was effectively
   * always enabled and the "Skip waiting" link never appeared.
   *
   * 'contracts' stays in the flow-page stack while merely covered by the
   * overlay (isPageInStack() is true), so use that instead to tell "covered
   * but coming back" apart from "actually left" (e.g. navigated fully away
   * via backToContractsList()) — only the latter should flush a terminal
   * state so pendingConfirmation doesn't get stuck at 'checking' forever.
   *
   * That alone isn't enough when this component is router-hosted (see
   * `destroyed`'s doc comment): isPageInStack('contracts') is then always
   * false, since this page was never pushed onto that stack in the first
   * place, even though the routed instance stays mounted the whole time.
   * Require this instance to have actually been destroyed too, so the
   * routed hosting mode never bails just because it isn't (and never was)
   * a flow page.
   */
  private bailIfLeftContractsFlow(): boolean {
    if (!this.destroyed) return false;
    if (this.flowPagesService.isPageInStack('contracts')) return false;
    this.approvalFlowService.setPendingConfirmation({
      status: 'unavailable',
      message:
        'Left the contracts page before indexing finished. The transaction was still broadcast.',
    });
    return true;
  }

  /**
   * Updates the contracts page's own indexer-status display and mirrors it
   * into ApprovalFlowService.pendingConfirmation — the approval success
   * page's "Done" button reads that to stay disabled until the indexer has
   * actually caught up, instead of letting the user dismiss the success
   * screen and navigate to "My Contracts" while it's still stale.
   */
  private setActionIndexerState(state: ActionIndexerState) {
    this.interactIndexerState.set(state);

    const statusMap: Record<
      ActionIndexerState['status'],
      PendingActionConfirmation['status']
    > = {
      checking: 'checking',
      indexed: 'confirmed',
      unavailable: 'unavailable',
      'not-indexed': 'timed-out',
    };
    this.approvalFlowService.setPendingConfirmation({
      status: statusMap[state.status],
      message: state.message,
    });
  }

  /**
   * Has the merged dashboard entry caught up with the optimistic update we
   * already applied to the local registry entry? Without a registry entry to
   * compare against (e.g. an import flow with no local id) there's nothing
   * more to wait for, so we treat that as already caught up.
   */
  private dashboardCaughtUpWithLocal(registryEntryId?: string): boolean {
    if (!registryEntryId) return true;

    const localEntry = this.registryContracts().find(
      (contract) => contract.id === registryEntryId,
    );
    if (!localEntry) return true;

    const target = this.dashboardContracts().find(
      (candidate) => candidate.registryEntry?.id === registryEntryId,
    );
    if (!target) return false;

    if (localEntry.status === 'spent') return target.status === 'spent';

    try {
      return (
        BigInt(target.amountSompi || '0') ===
        BigInt(localEntry.amountSompi || '0')
      );
    } catch {
      return target.amountSompi === localEntry.amountSompi;
    }
  }

  /**
   * Handles ContractLookupImportComponent's `(interactRequested)` output —
   * mirrors what importLookupContract() used to do directly: switch to the
   * interact tab with the looked-up UTXO + contract JSON pre-filled.
   */
  onLookupInteractRequested(event: LookupInteractRequest) {
    this.interactContractJson.set(event.contractJson);
    this.interactOutpointTxid = event.outpointTxid;
    this.interactOutpointVout = event.outpointVout;
    this.interactInputAmount = event.inputAmount;
    this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
    this.switchTab('interact');
  }

  /**
   * Get explorer link for address
   */
  getExplorerAddressLink(address: string): string {
    return this.display.getExplorerAddressLink(address);
  }

  /**
   * Get explorer link for transaction
   */
  getExplorerLink(txid: string): string {
    return this.display.getExplorerLink(txid);
  }

  /**
   * Get covenant explorer link for a covenant ID (covenants.kaspa.com), if the current network has one configured
   */
  getCovenantExplorerLink(covenantId: string): string | undefined {
    return this.display.getCovenantExplorerLink(covenantId);
  }

  /**
   * Truncate string for display
   */
  truncate(str: string | null | undefined, length: number = 16): string {
    return this.display.truncate(str, length);
  }

  /**
   * Format sompi to KAS
   */
  formatSompiToKas(sompi: string): string {
    return this.display.formatSompiToKas(sompi);
  }

  getSourceLabel(contract: ContractDashboardEntry): string {
    return this.display.getSourceLabel(contract);
  }

  getSourceLabels(contract: ContractDashboardEntry): string[] {
    return this.display.getSourceLabels(contract);
  }

  getStatusLabel(contract: ContractDashboardEntry): string {
    return this.display.getStatusLabel(contract);
  }

  formatTimestamp(value: number | undefined | null): string {
    return this.display.formatTimestamp(value);
  }

  formatActionName(action: string): string {
    return this.display.formatActionName(action);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
