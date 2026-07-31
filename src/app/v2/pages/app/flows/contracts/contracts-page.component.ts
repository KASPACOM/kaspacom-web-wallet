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
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DropdownOption,
  KcButtonComponent,
  KcDropdownSelectComponent,
  KcIconComponent,
  KcInputComponent,
  KcNumberInputComponent,
  KcStepperComponent,
  KcTooltipDirective,
  NotificationService,
} from '@kaspacom/ui-kit';
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
import type { CovenantFunctionArg } from '../../../../../services/covenant/covenant-sdk/covenant';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import {
  PartialSpendJsonDialogData,
  PartialSpendJsonModalComponent,
} from './components/partial-spend-json-modal/partial-spend-json-modal.component';
import { downloadJsonFile, readJsonFile } from './json-file.util';
import { ContractTemplate } from '../../../../services/covenant/contract-templates';
import {
  CtorArg,
  TemplatePatch,
  TemplatePatcherService,
} from '../../../../services/covenant/template-patcher.service';
import { KaspaL1NetworkService } from '../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { WalletActionType } from '../../../../../types/wallet-action';
import {
  CovenantCompletePartialActionResult,
  CovenantSpendActionResult,
} from '../../../../../types/wallet-action-result';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { WideWorkspaceService } from '../../../../services/wide-workspace.service';
import {
  ApprovalFlowService,
  PendingActionConfirmation,
} from '../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CovenantDateTimeInputComponent } from './covenant-date-time-input.component';
import { WalletProfileOrbComponent } from '../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';
import {
  ActionFieldConfigEntry,
  CONTRACT_ACTION_FIELDS,
} from './contract-action-fields.config';
import { ContractActionFieldsComponent } from './components/contract-action-fields/contract-action-fields.component';

import {
  TabName,
  ContractDetailTab,
  ContractsTransientState,
  IndexerImportPreview,
  ContractDashboardSource,
  ContractDashboardFilter,
  ContractStatusFilter,
  ContractParticipant,
  ContractDashboardEntry,
  ContractDetailState,
  ContractDetailParameter,
  AvailableAction,
  DeployIndexerState,
  ActionIndexerState,
  SELF_CUSTODY_WHITELIST_CAPACITY,
} from './contracts-page.models';
import { ContractDisplayService } from './services/contract-display.service';
import { CovenantTemplateService } from './services/covenant-template.service';
import {
  ContractsDataService,
  ContractsDashboardBuildContext,
} from './services/contracts-data.service';
import { hex32ToBytes, computeBlake2bHex } from './crypto.util';
import {
  ContractTemplateDeployFormComponent,
  ContractDeployedEvent,
} from './components/contract-template-deploy-form/contract-template-deploy-form.component';

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
    KcStepperComponent,
    KcTooltipDirective,
    CopyButtonComponent,
    AddressSmartInputComponent,
    CovenantDateTimeInputComponent,
    WalletProfileOrbComponent,
    ContractActionFieldsComponent,
    ContractTemplateDeployFormComponent,
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
  private dialog = inject(Dialog);
  private platformId = inject(PLATFORM_ID);
  private notificationService = inject(NotificationService);
  private isBrowser = isPlatformBrowser(this.platformId);
  private display = inject(ContractDisplayService);
  private templateService = inject(CovenantTemplateService);
  private contractsData = inject(ContractsDataService);
  private routeSubscription?: Subscription;
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
  selectedDetailError = signal<string | null>(null);
  detailPanelTab = signal<ContractDetailTab>('details');
  /**
   * Whether the "action" panel shows the curated action list or one
   * selected action's full-page form — mutually exclusive with the list
   * once an action is picked, unlike detailPanelTab which just toggles
   * whether this whole panel appears below the always-visible details.
   */
  actionPageView = signal<'list' | 'form'>('list');
  detailRouteId = signal<string | null>(null);
  detailRouteNotFound = signal(false);
  pendingUrlImport = signal<string | null>(null);
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
   * (custom / tracking-incomplete) → 'default' (neutral UI).
   */
  getTemplateKey(
    input: any,
  ): 'deadman' | 'timelock' | 'multisig' | 'escrow' | 'default' {
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

  // Set in ngOnDestroy() so trackActionIndexing()'s poll loop can bail out
  // instead of updating signals/services and scheduling more RPC/indexer
  // traffic after the component is gone.
  private destroyed = false;

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
  dmsNewExpiry = ''; // new expiry entered by user — unix seconds, unix ms, or a date string; see parseDateToUnixMs()
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
      this.selectedFunction === 'keepAlive'
    )
      return [];
    if (
      contract.contract_name === 'SelfCustodyVault' &&
      ['emergencySweep', 'finalize'].includes(this.selectedFunction)
    ) {
      return abiEntry.inputs.filter(
        (i) =>
          (i.type_name === 'int' || i.type_name === 'bool') &&
          i.name !== 'destinationIndex',
      );
    }
    // Only render extra-arg inputs the interact flow can actually collect/pass
    // (collectExtraArgs + completePartialSpend handle int/bool only).
    return abiEntry.inputs.filter(
      (i) => i.type_name === 'int' || i.type_name === 'bool',
    );
  }

  getExtraArgLabel(arg: { name: string; type_name: string }): string {
    const contract = this.parsedInteractContract();
    if (
      contract?.contract_name === 'SelfCustodyVault' &&
      arg.name === 'destinationIndex'
    ) {
      return 'Whitelist destination index';
    }
    return `${arg.name} (${arg.type_name})`;
  }

  getExtraArgPlaceholder(arg: { name: string; type_name: string }): string {
    const contract = this.parsedInteractContract();
    if (
      contract?.contract_name === 'SelfCustodyVault' &&
      arg.name === 'destinationIndex'
    ) {
      return '0 for first whitelisted address';
    }
    return `Enter ${arg.name} value`;
  }

  getExtraArgHelp(arg: { name: string; type_name: string }): string {
    const contract = this.parsedInteractContract();
    if (
      contract?.contract_name === 'SelfCustodyVault' &&
      arg.name === 'destinationIndex'
    ) {
      return 'Finalize and Emergency Sweep create the hot/cold signature automatically. This number selects which whitelisted destination must match the withdrawal address; leave 0 when there is no whitelist or to use the first whitelist entry.';
    }
    return `${arg.type_name} argument passed to the selected contract function.`;
  }

  onExtraArgValueChange(name: string, value: any) {
    this.extraArgValues[name] = value || '';
  }

  onTopUpAmountChange(value: any) {
    this.topUpAmount = value || '';
    this.interactError.set(null);
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
    void this.ensureContractRegistryMigrated();
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
    this.destroyed = true;
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

  private ensureContractRegistryMigrated(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    this.registryMigrationPromise ??=
      this.registryService.migrateContractsRegistryFromLocalStorage();
    return this.registryMigrationPromise;
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
    const indexerEntriesPromise = this.contractsData.loadIndexerDashboardEntries(
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
      const [indexerEntries, refreshedLocalDashboardEntries] =
        await Promise.all([indexerEntriesPromise, localRefreshPromise]);
      if (!isCurrentRequest()) return;

      localDashboardEntries = refreshedLocalDashboardEntries;
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
      this.dashboardContracts.set(
        this.sortDashboardEntries(localDashboardEntries),
      );
    } finally {
      if (isCurrentRequest()) {
        this.indexerLoading.set(false);
      }
    }

    if (!isCurrentRequest()) return;

    const routeId = this.detailRouteId();
    if (routeId) {
      await this.openDetailFromRoute(routeId);
    } else if (this.activeTab() === 'detail' && this.selectedDetail()) {
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
            }),
          }
        : detail,
    );
  }

  private isCurrentWalletRegistryEntry(
    contract: ContractRegistryEntry,
  ): boolean {
    const walletKey = this.currentWalletAliasKey();
    if (walletKey && contract.wallets?.[walletKey]) return true;

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

  private currentWalletAliasKey(): string | undefined {
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

  async saveAlias(contract: ContractDashboardEntry) {
    const walletKey = this.currentWalletAliasKey();
    const registryEntry = contract.registryEntry;
    if (!registryEntry) {
      this.showAliasUnavailableNotice(contract);
      this.editingAliasKey.set(null);
      return;
    }
    if (!walletKey) return;

    const alias = this.aliasDraft.trim();
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

  private findRegistryEntryForDashboard(input: {
    covenantId?: string;
    deployTxid?: string;
    outpoint?: { txid: string; vout: number };
  }): ContractRegistryEntry | undefined {
    return this.findSavedRegistryEntryForIdentity(input);
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

  private getTemplateDisplayName(name: string): string {
    return this.display.getTemplateDisplayName(name);
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

  private roleLabel(role: string): string {
    return this.contractsData.roleLabel(role);
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

  private getNextActionLabel(
    contractName: string,
    status: ContractDashboardEntry['status'],
    participants: ContractParticipant[],
  ): string {
    return this.contractsData.getNextActionLabel(
      contractName,
      status,
      this.currentWalletRoles(participants),
    );
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

  /** Public wrapper for the detail page's "You are <role>" pill. */
  getCurrentRoleLabel(participants: ContractParticipant[] = []): string {
    return this.currentWalletRoles(participants).join(' / ');
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
    options?: { silent?: boolean; skipScrollToTop?: boolean },
  ) {
    const silent = options?.silent ?? false;
    const skipScrollToTop = options?.skipScrollToTop ?? false;
    const requestToken = ++this.detailRequestToken;
    const isCurrentRequest = () => requestToken === this.detailRequestToken;

    if (!silent) {
      this.loadingRequestToken = requestToken;
      this.selectedDetailLoading.set(true);
      this.selectedDetail.set({
        entry: this.withDashboardName(entry),
        actions: [],
        utxos: [],
      });
      if (this.detailRouteId() || this.activeTab() === 'detail') {
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
        (this.detailRouteId() || this.activeTab() === 'detail') &&
        updatedEntry.status === 'active'
      ) {
        const prepared = await this.prepareDashboardAction(
          updatedEntry,
          requestToken,
          silent,
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
          detailRouteId: this.detailRouteId(),
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
          (this.detailRouteId() || this.activeTab() === 'detail') &&
          entry.status === 'active'
        ) {
          await this.prepareDashboardAction(entry, requestToken, silent);
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
    await this.openContractDetail(entry, { skipScrollToTop: true });
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
      this.selectFunction(fnName);
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
      this.selectContractFromRegistry();
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
      this.selectContractFromRegistry();
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
        this.selectContractFromRegistry();
        const hasEnabledDefault = this.selectDefaultFunctionForContract(entry);
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
          this.actionPageView.set(hasEnabledDefault ? 'form' : 'list');
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
    const registryEntry = entry.registryEntry!;
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

    if (detail?.entry.id === entry.id && detail.response) {
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
    void this.openContractDetail(entry);
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
      topUp: {
        label: 'Top Up',
        description:
          'Add more KAS to the locked funds without withdrawing anything.',
        iconClass: 'icon-add',
      },
    },
    MultiSigVault: {
      spend12: {
        label: '2-of-3 Withdraw (Signer 1 + 2)',
        description:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 1 and Signer 2.',
        iconClass: 'icon-coins-02',
        extraGuard: (detail) =>
          this.requireOneOfSigners(detail, 'Signer 1', 'Signer 2'),
      },
      spend13: {
        label: '2-of-3 Withdraw (Signer 1 + 3)',
        description:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 1 and Signer 3.',
        iconClass: 'icon-coins-02',
        extraGuard: (detail) =>
          this.requireOneOfSigners(detail, 'Signer 1', 'Signer 3'),
      },
      spend23: {
        label: '2-of-3 Withdraw (Signer 2 + 3)',
        description:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 2 and Signer 3.',
        iconClass: 'icon-coins-02',
        extraGuard: (detail) =>
          this.requireOneOfSigners(detail, 'Signer 2', 'Signer 3'),
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
  actionsPanelReady = computed(
    () =>
      !this.selectedDetailLoading() &&
      !!this.selectedDetail() &&
      !!this.currentWallet(),
  );

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
      const existsOnChain = availableNames.has(fnName);

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

  getSelfCustodyWhitelistWallets(detail: ContractDetailState): string[] {
    if (
      this.normalizeContractName(detail.entry.contractName) !==
      'SelfCustodyVault'
    ) {
      return [];
    }

    const args = this.selfCustodyArgsForDetail(detail);
    const mode = String(args['whitelistMode'] || '').toLowerCase();
    const raw = args['whitelistedDestinations'];
    if (mode && mode !== 'whitelist') return [];
    if (!raw) return [];

    return raw
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
  }

  getSelfCustodyInteractWhitelistWallets(): string[] {
    const contract = this.parsedInteractContract();
    if (contract?.contract_name !== 'SelfCustodyVault') return [];

    const args = this.templateService.argsArrayToRecord(
      this.normalizeIndexerArgs(contract.tn10?.args),
    );
    const mode = String(args['whitelistMode'] || '').toLowerCase();
    const raw = args['whitelistedDestinations'];
    if (mode && mode !== 'whitelist') return [];
    if (!raw) return [];

    return this.templateService.getAddressListFromRaw(raw);
  }

  onSelfCustodySweepDestinationChange(address: string) {
    this.interactOutputAddress = address || '';
    this.interactResolvedOutputAddress = null;
    this.extraArgValues['destinationIndex'] = String(
      Math.max(
        0,
        this.getSelfCustodyInteractWhitelistWallets().indexOf(address),
      ),
    );
    this.interactError.set(null);
  }

  getSelfCustodyPhaseInfo(detail: ContractDetailState): string | null {
    const phase = this.getSelfCustodyPhase(detail);
    if (phase === undefined) return null;
    if (phase === 0) return '0 - locked';
    if (phase === 1) return '1 - unvaulting';
    return `${phase} - unknown`;
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

  /** Field-layout config for a curated action's full-page form, keyed the same way as actionMetaTable. */
  getActionFieldConfig(
    contractName: string,
    fnName: string,
  ): ActionFieldConfigEntry | null {
    const normalized = this.normalizeContractName(contractName);
    return CONTRACT_ACTION_FIELDS[normalized]?.[fnName] ?? null;
  }

  /** The curated label/description for the currently selected action, for the full-page form's header. */
  getSelectedActionMeta(
    detail: ContractDetailState,
  ): AvailableAction | undefined {
    return this.getAvailableActions(detail).find(
      (action) => action.fnName === this.selectedFunction,
    );
  }

  /**
   * Field config for whatever function is currently selected. Null for
   * generic/custom contracts with no curated actionMetaTable entry — those
   * keep rendering the old manual/ABI-driven chain instead of this form.
   *
   * Plain method (not computed()) for the same reason as extraArgsForFunction():
   * selectedFunction is a plain string, not a signal, so a computed() would
   * not re-evaluate when it changes.
   */
  getSelectedActionFieldConfig(): ActionFieldConfigEntry | null {
    const contract = this.parsedInteractContract();
    if (!contract || !this.selectedFunction) return null;
    return this.getActionFieldConfig(
      contract.contract_name,
      this.selectedFunction,
    );
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
        ? ['recover', 'spend', 'topUp']
        : ['spend', 'recover', 'topUp'],
      MultiSigVault: ['spend12', 'spend13', 'spend23', 'topUp'],
      EscrowWithArbiter: currentRoles.includes('Arbiter')
        ? ['arbitrate', 'release', 'refund', 'topUp']
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
    this.selectFunction(target);
    return true;
  }

  private selectedFunctionExists(): boolean {
    if (!this.selectedFunction) return false;
    return this.availableFunctions().some(
      (fn) => fn.name === this.selectedFunction,
    );
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
    const scriptHash =
      response.covenant?.scriptHashHex ||
      preview.activeAction.scriptHashHex ||
      response.action.scriptHashHex;
    const registryEntry = this.findRegistryEntryForDashboard({
      covenantId: preview.covenantId,
      deployTxid: preview.deployTxid,
      outpoint: preview.outpoint,
    });

    return this.withDashboardName({
      id: `indexer:${preview.covenantId}`,
      source: 'indexer',
      contractName,
      displayName: this.getTemplateDisplayName(contractName),
      contractTypeLabel: this.getTemplateDisplayName(contractName),
      aliases: registryEntry?.aliases,
      status,
      amountSompi: preview.amountSompi,
      currentAddress: preview.contractAddress,
      covenantId: preview.covenantId,
      scriptHash,
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
      registryEntry,
      indexerSummary: response.covenant,
    });
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
      this.templateService.logSelfCustodyContractParams('indexer import compile', {
        fieldValues,
        tn10: compiled.tn10,
        activeState: activeAction?.outputs?.state,
        activeUtxoState: activeUtxo?.state,
        scriptLength: compiled.script?.length,
        address: this.covenantService.getContractAddress(compiled),
      });
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
      baseFieldValues['initUnvaultDelaySeconds'],
      baseFieldValues['unvaultDelaySeconds'],
      String(state['vaultUnvaultDelaySeconds'] ?? ''),
      String(state['unvaultDelaySeconds'] ?? ''),
    ]);

    for (const initPhase of phaseCandidates) {
      for (const unvaultDelaySeconds of delayCandidates) {
        const fieldValues = {
          ...baseFieldValues,
          initPhase,
          initUnvaultDelaySeconds: unvaultDelaySeconds,
        };
        try {
          const compiled = await this.compileTemplateWithFieldValues(
            template,
            fieldValues,
          );
          const address = this.covenantService.getContractAddress(compiled);
          if (address === contractAddress) {
            this.templateService.logSelfCustodyContractParams('indexer variant matched', {
              fieldValues,
              activeState: state,
              address,
            });
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
          initUnvaultDelaySeconds: String(
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
    const { compiled, descriptor } = await this.templateService.getTemplatePatchContext(
      template.id,
    );
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
   * Handles the ContractTemplateDeployFormComponent's `(deployed)` output —
   * the "record a successful deploy into the local registry" tail that used
   * to run inline inside this component's own deployContract(). The child
   * calls `event.resolve(...)` with the outcome so it can drive its own
   * deployIndexerState/deployResult signals afterward (registryEntryId is
   * needed to backfill the covenant ID once indexing settles).
   */
  async onContractDeployed(event: ContractDeployedEvent) {
    const walletKey = this.currentWalletAliasKey();
    const entry: ContractRegistryEntry = {
      id: this.registryService.generateId(),
      contractName: event.compiled.contract_name || 'Unnamed Contract',
      compiledJson: event.contractJson,
      deployTxid: event.result.txid,
      contractAddress: event.result.contractAddress,
      outpoint: event.result.outpoint,
      amountSompi: event.amountSompi.toString(),
      deployedBy: {
        address: event.walletAddress,
        pubkey: event.pubkey,
        accountName: event.walletDisplayName,
      },
      deployedAt: Date.now(),
      network: this.network(),
      status: 'active',
      accessRoles: this.parseAccessRoles(event.compiled),
      covenantId: event.result.covenantId,
      wallets: walletKey ? { [walletKey]: true } : undefined,
    };

    try {
      await this.registryService.addContract(entry);
      this.allRegistryContracts.set([...this.allRegistryContracts(), entry]);
      this.registryContracts.set([...this.registryContracts(), entry]);
      const clearNickname = await this.saveInitialContractAlias(
        entry,
        event.nickname,
      );
      event.resolve({ registryEntryId: entry.id, clearNickname });
    } catch (e) {
      console.error(
        '[Deploy] Contract deployed but failed to save to registry:',
        e,
      );
      event.resolve({
        saveError: `Contract deployed (txid ${event.result.txid}), but saving it locally failed. Record the outpoint to interact later: ${event.result.outpoint.txid}:${event.result.outpoint.vout}.`,
      });
    }
  }

  /** Returns whether the nickname was actually saved (so the caller can clear its own field). */
  private async saveInitialContractAlias(
    entry: ContractRegistryEntry,
    nickname: string,
  ): Promise<boolean> {
    const alias = nickname.trim();
    const walletKey = this.currentWalletAliasKey();
    if (!alias || !walletKey) return false;

    await this.updateRegistryContract(entry.id, {
      aliases: {
        ...(entry.aliases || {}),
        [walletKey]: alias,
      },
    });
    this.refreshDashboardNames();
    return true;
  }

  /**
   * Applies a registry-entry patch emitted by a child component (deploy
   * form, action panel) that doesn't own allRegistryContracts/registryContracts
   * itself.
   */
  onRegistryEntryUpdated(event: {
    id: string;
    updates: Partial<ContractRegistryEntry>;
  }) {
    void this.updateRegistryContract(event.id, event.updates);
  }

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
    this.setActionIndexerState({
      txid,
      status: 'checking',
      message: 'Waiting for the indexer to see this transaction...',
    });

    let seenSettled = false;

    for (let attempt = 1; attempt <= 8; attempt++) {
      if (this.destroyed) return;
      try {
        if (!seenSettled) {
          const status =
            await this.covenantIndexerService.getTransactionSettlementStatus(
              txid,
            );
          if (this.destroyed) return;
          seenSettled = status.indexed;
        }

        if (seenSettled) {
          await this.loadContracts({ skipOnChainStatusRefresh: true });
          if (this.destroyed) return;
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
            message: `Transaction confirmed — waiting for the contract list to catch up (${attempt}/8)...`,
          });
        } else {
          this.setActionIndexerState({
            txid,
            status: 'checking',
            message: `Waiting for indexer confirmation (${attempt}/8)...`,
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
      if (this.destroyed) return;
    }

    this.setActionIndexerState({
      txid,
      status: 'not-indexed',
      message:
        'Broadcast, but My Contracts may not reflect this change yet. Refresh in a moment.',
    });
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
      this.logContractsDebug(
        '[Contracts][actions] Selected registry contract for interaction',
        {
          selectedContractId: contract.id,
          contractName: contract.contractName,
          contractAddress: contract.contractAddress,
          outpoint: contract.outpoint,
          amountSompi: contract.amountSompi,
          covenantId: contract.covenantId,
          status: contract.status,
          compiledJsonLength: contract.compiledJson?.length,
        },
      );
    } else {
      console.warn(
        '[Contracts][actions] Selected registry contract not found',
        {
          selectedContractId: this.selectedContractId(),
          registryCount: this.registryContracts().length,
        },
      );
    }
  }

  /**
   * Interact with a contract
   */
  async interactContract() {
    this.interactError.set(null);
    this.interactResult.set(null);
    this.interactIndexerState.set(null);

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

    try {
      this.isInteracting.set(true);

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const outpoint: CovenantOutpoint = { txid: txid.trim(), vout };
      const inputAmount = BigInt(inputAmountSompi);
      const privateKey = wallet.getPrivateKey().toString();

      // Build outputs based on function type
      let outputs: SpendOutput[];
      let extraArgsOverride: Record<string, CovenantFunctionArg> | undefined;
      let useSenderFeeOverride: boolean | undefined;
      let covenantIdOverride: string | undefined;
      let transactionPayloadHex: string | undefined;

      if (this.isTopUpFunction(functionName)) {
        if (isNaN(topUpAmountKas) || topUpAmountKas <= 0) {
          this.interactError.set('Top-up amount must be greater than 0');
          return;
        }

        const covenantId =
          this.selectedContract()?.covenantId ||
          this.selectedDetail()?.entry.covenantId;
        covenantIdOverride = covenantId;
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
        if (compiled.contract_name === 'SelfCustodyVault') {
          transactionPayloadHex = this.buildSelfCustodyPayloadHex(compiled, 0);
          this.templateService.logSelfCustodyContractParams('topUp continuation output', {
            inputAmountSompi: inputAmount,
            topUpAmountSompi: topUpAmount,
            outputs,
            covenantId,
            currentTn10: compiled.tn10,
            currentAddress: this.covenantService.getContractAddress(compiled),
          });
        }
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
        // The contract always emits two outputs (seller, buyer). A zero-value
        // output is invalid on Kaspa's UTXO model and crashes the WASM tx
        // builder, so awarding the full balance to one side isn't possible —
        // reject it here with a clear message instead of letting it panic.
        if (amountToSellerSompi >= inputAmount) {
          this.interactError.set(
            "Amount to seller must be less than the full contract balance. Arbitrate always pays out both sides, so the buyer's output can't be zero.",
          );
          return;
        }
        const amountToBuyerSompi = inputAmount - amountToSellerSompi;

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
            await this.updateRegistryContract(this.selectedContractId(), {
              status: 'spent',
              spendTxid: result.txid,
              lastChecked: Date.now(),
            });
            void this.trackActionIndexing(
              result.txid,
              this.selectedContractId(),
            );
          }
          return;
        }
      } else if (
        functionName === 'release' &&
        compiled.contract_name === 'Escrow'
      ) {
        // Escrow release: the contract enforces
        // require(tx.outputs[0].scriptPubKey == byte[](sellerLock)),
        // so output[0] must always pay the seller — regardless of whether
        // the buyer or seller wallet builds/submits the partial spend.
        // Derive the seller's address from the pubkey baked into the
        // compiled script rather than defaulting to the current wallet.
        if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
          this.interactError.set(
            'Enter the amount to release to the seller in the "Withdraw Amount" field',
          );
          return;
        }
        const releaseAmountSompi = BigInt(Math.floor(outputAmountKas * 1e8));

        // Escrow constructor order: buyer (param 0), seller (param 1).
        const pubkeys = this.extractPubkeysFromScript(compiled);
        const sellerAddress = pubkeys[1]
          ? this.pubkeyToAddress(pubkeys[1])
          : '';

        if (!sellerAddress) {
          this.interactError.set(
            'Could not derive seller address from contract script',
          );
          return;
        }

        const releaseOutputs = this.buildWithdrawalOutputs(
          compiled,
          inputAmount,
          sellerAddress,
          releaseAmountSompi,
        );
        if (!releaseOutputs) return;
        outputs = releaseOutputs;
      } else if (this.isDmsChangeHeir()) {
        await this.executeDmsChangeHeir(
          compiled,
          contractJson,
          outpoint,
          inputAmount,
          outputAddress,
        );
        return;
      } else if (this.isSelfCustodyUnvault()) {
        await this.executeSelfCustodyUnvault(
          compiled,
          contractJson,
          outpoint,
          inputAmount,
        );
        return;
      } else if (this.isDmsClaim()) {
        // DMS claim always transfers the entire balance to the heir — there's
        // no continuation output for a remainder to go to, since the
        // Dead Man's Switch relationship ends once claimed. Ignore whatever
        // amount the user may have typed and use the full input amount
        // instead of routing through buildWithdrawalOutputs's partial path.
        if (!outputAddress) {
          this.interactError.set('Output address is required');
          return;
        }
        outputs = [
          {
            address: outputAddress,
            amount: inputAmount,
          },
        ];
      } else if (this.functionRequiresOutput(functionName)) {
        if (
          compiled.contract_name === 'DeadManSwitch' &&
          functionName === 'withdraw'
        ) {
          // Blocked even though availableFunctions() already hides this —
          // legacy on-chain contracts may still carry the ABI entry, and a
          // generic withdrawal would let the owner drain the full balance
          // to an arbitrary address instead of using keepAlive/claim.
          this.interactError.set(
            "Dead Man's Switch doesn't support a direct withdraw. Use Keep Alive to reset the deadline, or Claim after it passes.",
          );
          return;
        }
        // Withdrawal function — validate user-provided output
        if (!outputAddress) {
          this.interactError.set('Output address is required');
          return;
        }
        if (
          compiled.contract_name === 'SelfCustodyVault' &&
          ['emergencySweep', 'finalize'].includes(functionName)
        ) {
          const whitelist = this.getSelfCustodyInteractWhitelistWallets();
          if (whitelist.length > this.selfCustodyWhitelistCapacity) {
            this.interactError.set(
              `This Self-Custody Vault has ${whitelist.length} whitelist addresses, but the current contract artifact supports ${this.selfCustodyWhitelistCapacity}. Recreate the vault with a supported whitelist before sweeping or finalizing.`,
            );
            return;
          }
          if (whitelist.length > 0) {
            const destinationIndex = whitelist.findIndex(
              (address) => address === outputAddress,
            );
            if (destinationIndex < 0) {
              this.interactError.set(
                'Select one of the whitelisted destination wallets.',
              );
              return;
            }
            this.extraArgValues['destinationIndex'] = String(destinationIndex);
            outputAddress = whitelist[destinationIndex];
          } else {
            this.extraArgValues['destinationIndex'] = '0';
          }
          outputs = [{ address: outputAddress, amount: inputAmount }];
          extraArgsOverride = this.collectExtraArgs(compiled, functionName);
          useSenderFeeOverride = true;
        } else {
          if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
            this.interactError.set('Output amount must be greater than 0');
            return;
          }
          const withdrawalAmount = BigInt(Math.floor(outputAmountKas * 1e8));
          if (
            functionName === 'transfer' &&
            compiled.contract_name === 'KCC20'
          ) {
            try {
              extraArgsOverride = {
                recipient: Uint8Array.from(
                  this.templatePatcher.kaspaAddressToPubkeyBytes(outputAddress),
                ),
              };
            } catch {
              this.interactError.set('Enter a valid recipient Kaspa address');
              return;
            }
          }
          const withdrawalOutputs = this.buildWithdrawalOutputs(
            compiled,
            inputAmount,
            outputAddress,
            withdrawalAmount,
          );
          if (!withdrawalOutputs) return;
          outputs = withdrawalOutputs;
        }
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
        const partialExtraArgs = this.collectExtraArgs(compiled, functionName);
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
                Object.keys(partialExtraArgs).length > 0
                  ? partialExtraArgs
                  : undefined,
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
          partialExtraArgs,
        );
        const partialJson = JSON.stringify(partial, null, 2);
        this.partialSpendJson.set(partialJson);
        this.flowPagesService.saveTransientState('contracts', {
          activeTab: this.activeTab(),
          detailPanelTab: this.detailPanelTab(),
          actionPageView: this.actionPageView(),
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
        this.openPartialSpendJsonDialog(partialJson);
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
        covenantIdOverride,
        useSenderFeeOverride ?? this.useSenderFee,
        transactionPayloadHex,
      );
      if (!result) return;

      this.interactResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Update registry based on function type
      if (this.selectedContractId()) {
        if (this.isTopUpFunction(functionName)) {
          await this.updateRegistryContract(this.selectedContractId(), {
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
            await this.updateRegistryContract(this.selectedContractId(), {
              lastChecked: Date.now(),
              outpoint: { txid: result.txid, vout: continuationOutputIndex },
              amountSompi: continuationAmount.toString(),
            });
            this.interactOutpointTxid = result.txid;
            this.interactOutpointVout = continuationOutputIndex.toString();
            this.interactInputAmount = continuationAmount.toString();
          } else {
            // Full withdrawal: funds left the covenant
            await this.updateRegistryContract(this.selectedContractId(), {
              status: 'spent',
              spendTxid: result.txid,
              lastChecked: Date.now(),
            });
          }
        } else {
          // Redeploy (keepAlive/increment): update the outpoint to the new UTXO
          await this.updateRegistryContract(this.selectedContractId(), {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: 0 },
            amountSompi: inputAmount.toString(), // The registry doesn't accurately know the post-fee amount until refreshed, but setting inputAmount is close enough
          });
          // Update the interact form with the new outpoint
          this.interactOutpointTxid = result.txid;
          this.interactOutpointVout = '0';
        }
        void this.trackActionIndexing(result.txid, this.selectedContractId());
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

  private async executeSelfCustodyUnvault(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmount: bigint,
  ): Promise<void> {
    const covenantId =
      this.selectedContract()?.covenantId ||
      this.selectedDetail()?.entry.covenantId;
    if (!covenantId) {
      this.interactError.set(
        'Cannot unvault until this contract covenant ID is known. Refresh/import it from the indexer first.',
      );
      return;
    }

    const nextCompiled = await this.compileSelfCustodyContinuation(compiled, 1);
    const nextContractJson = JSON.stringify(nextCompiled, null, 2);
    const nextContractAddress =
      this.covenantService.getContractAddress(nextCompiled);
    this.templateService.logSelfCustodyContractParams('unvault continuation target', {
      inputAmountSompi: inputAmount,
      covenantId,
      currentTn10: compiled.tn10,
      nextTn10: nextCompiled.tn10,
      currentAddress: this.covenantService.getContractAddress(compiled),
      nextAddress: nextContractAddress,
      nextScriptLength: nextCompiled.script?.length,
    });
    const payloadHex = this.buildSelfCustodyPayloadHex(nextCompiled, 1);

    const result = await this.runCovenantSpendAction(
      compiled,
      contractJson,
      outpoint,
      inputAmount,
      'unvault',
      [
        {
          address: nextContractAddress,
          amount: inputAmount,
          covenantId,
        },
      ],
      undefined,
      covenantId,
      true,
      payloadHex,
    );
    if (!result) return;

    this.interactResult.set({ txid: result.txid, functionName: 'unvault' });

    if (this.selectedContractId()) {
      await this.updateRegistryContract(this.selectedContractId(), {
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

    void this.trackActionIndexing(result.txid, this.selectedContractId());
  }

  /**
   * Execute a Dead Man's Switch keepAlive:
   *   1. Validates the new expiry input.
   *   2. Builds a continuation script with the same owner/heir and new deadline.
   *   3. Calls keepAlive(sig, newDeadline), sending funds to the continuation script.
   *   4. Updates the local outpoint for the continued covenant UTXO.
   */
  private async executeDmsKeepAlive(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmount: bigint,
  ): Promise<void> {
    this.interactError.set(null);

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
      this.interactError.set(
        "This Dead Man's Switch was deployed with the old inactivity-period contract. It cannot be migrated to the new deadline contract with keepAlive; deploy a new deadline-based Dead Man's Switch.",
      );
      return;
    }

    if (!this.dmsNewExpiry.trim()) {
      this.interactError.set('Select the new check-in deadline');
      return;
    }

    const newDeadline = BigInt(
      this.templateService.parseDateToUnixMs(this.dmsNewExpiry, 'New check-in deadline'),
    );
    const currentDeadline = await this.extractTemplateIntField(
      compiled,
      'dead-mans-switch',
      'initDeadline',
    );
    const owner = await this.extractDmsPubkeyHex(compiled, 'owner');
    const heir = await this.extractDmsPubkeyHex(compiled, 'heir');
    const ownerAddress = owner ? this.pubkeyToAddress(owner) : '';
    const heirAddress = heir ? this.pubkeyToAddress(heir) : '';
    if (!ownerAddress || !heirAddress) {
      this.interactError.set(
        'Could not derive owner/heir addresses from contract script',
      );
      return;
    }

    const nextCompiled = await this.compileDmsContinuation({
      ownerAddress,
      heirAddress,
      deadlineMs: newDeadline,
    });
    const nextContractJson = JSON.stringify(nextCompiled, null, 2);
    const nextContractAddress =
      this.covenantService.getContractAddress(nextCompiled);
    const payloadHex = this.buildDmsPayloadHex({
      ownerAddress,
      heirAddress,
      deadlineMs: newDeadline,
    });

    // Build spend output: full amount -> updated-state DMS address, with CovenantBinding if we have a covenantId.
    const spendOutputs: SpendOutput[] = [
      {
        address: nextContractAddress,
        amount: inputAmount,
        covenantId: oldCovenantId, // attach binding to preserve lineage
      },
    ];

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
      payloadHex,
    );
    if (!result) return;

    this.interactResult.set({ txid: result.txid, functionName: 'keepAlive' });

    if (this.selectedContractId()) {
      await this.updateRegistryContract(this.selectedContractId(), {
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

    void this.trackActionIndexing(result.txid, this.selectedContractId());
  }

  private async executeDmsChangeHeir(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmount: bigint,
    newHeirAddress: string,
  ): Promise<void> {
    this.interactError.set(null);

    if (!newHeirAddress) {
      this.interactError.set('New heir wallet address is required');
      return;
    }

    const covenantId = this.selectedContract()?.covenantId;
    if (!covenantId) {
      this.interactError.set(
        'Cannot change heir until this contract covenant ID is known. Refresh/import it from the indexer first.',
      );
      return;
    }

    let newHeir: Uint8Array;
    try {
      newHeir = Uint8Array.from(
        this.templatePatcher.kaspaAddressToPubkeyBytes(newHeirAddress),
      );
    } catch {
      this.interactError.set('Enter a valid new heir wallet address');
      return;
    }

    const owner = await this.extractDmsPubkeyHex(compiled, 'owner');
    const ownerAddress = owner ? this.pubkeyToAddress(owner) : '';
    const currentDeadline = await this.extractTemplateIntField(
      compiled,
      'dead-mans-switch',
      'initDeadline',
    );
    if (!ownerAddress || currentDeadline === undefined) {
      this.interactError.set(
        'Could not derive owner/deadline from contract script',
      );
      return;
    }

    const nextCompiled = await this.compileDmsContinuation({
      ownerAddress,
      heirAddress: newHeirAddress,
      deadlineMs: currentDeadline,
    });
    const nextContractJson = JSON.stringify(nextCompiled, null, 2);
    const nextContractAddress =
      this.covenantService.getContractAddress(nextCompiled);
    const payloadHex = this.buildDmsPayloadHex({
      ownerAddress,
      heirAddress: newHeirAddress,
      deadlineMs: currentDeadline,
    });

    const result = await this.runCovenantSpendAction(
      compiled,
      contractJson,
      outpoint,
      inputAmount,
      'changeHeir',
      [
        {
          address: nextContractAddress,
          amount: inputAmount,
          covenantId,
        },
      ],
      { newHeir },
      covenantId,
      true,
      payloadHex,
    );
    if (!result) return;

    this.interactResult.set({ txid: result.txid, functionName: 'changeHeir' });

    if (this.selectedContractId()) {
      await this.updateRegistryContract(this.selectedContractId(), {
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
    this.interactOutputAddress = '';
    this.interactResolvedOutputAddress = null;

    void this.trackActionIndexing(result.txid, this.selectedContractId());
  }

  private async compileDmsContinuation(values: {
    ownerAddress: string;
    heirAddress: string;
    deadlineMs: bigint;
  }): Promise<CompiledContract> {
    const template = this.templateService.templateById('dead-mans-switch');
    if (!template) {
      throw new Error("Dead Man's Switch template is unavailable");
    }

    const { compiled, descriptor } = await this.templateService.getTemplatePatchContext(
      template.id,
    );
    return this.templatePatcher.applyPatch(compiled, descriptor, [
      this.templateService.bytesArg(
        this.templatePatcher.kaspaAddressToPubkeyBytes(values.ownerAddress),
      ),
      this.templateService.bytesArg(
        this.templatePatcher.kaspaAddressToPubkeyBytes(values.heirAddress),
      ),
      this.templateService.intArg(Number(values.deadlineMs)),
    ]) as CompiledContract;
  }

  private async compileSelfCustodyContinuation(
    currentCompiled: CompiledContract,
    phase: number,
  ): Promise<CompiledContract> {
    const template = this.templateService.templateById('self-custody-vault');
    if (!template) {
      throw new Error('Self-Custody Vault template is unavailable');
    }

    const baseCompiled = await firstValueFrom(
      this.http.get<any>(template.assetPath),
    );
    const descriptor = this.templatePatcher.extractPatchDescriptor(
      baseCompiled,
      template.placeholderArgs,
    );

    const pushDataPayload = (bytes: number[], name: string): number[] => {
      const opcode = bytes[0];
      let headerLength = 1;
      let payloadLength = opcode;
      if (opcode === 76) {
        headerLength = 2;
        payloadLength = bytes[1];
      } else if (opcode === 77) {
        headerLength = 3;
        payloadLength = bytes[1] | (bytes[2] << 8);
      } else if (opcode > 75) {
        throw new Error(`Unsupported pushdata opcode for ${name}`);
      }

      return bytes.slice(headerLength, headerLength + payloadLength);
    };

    const bytesArgFor = (name: string): CtorArg => {
      const param = descriptor.params.find((entry) => entry.name === name);
      const position = param?.positions[0];
      if (!param || !position) {
        throw new Error(`Self-Custody Vault template is missing ${name}`);
      }

      const bytes = currentCompiled.script.slice(
        position.offset,
        position.offset + position.length,
      );
      return this.templateService.bytesArg(
        param.paramType === 'pubkey[]' ? pushDataPayload(bytes, name) : bytes,
      );
    };

    const currentArgs = this.templateService.argsArrayToRecord(
      currentCompiled.tn10?.args || [],
    );
    const currentDelaySeconds = Number(currentArgs['unvaultDelaySeconds']);
    const delaySeconds = Number.isFinite(currentDelaySeconds)
      ? BigInt(currentDelaySeconds)
      : ((await this.extractTemplateIntField(
          currentCompiled,
          'self-custody-vault',
          'initUnvaultDelaySeconds',
        )) ??
        (await this.extractTemplateIntField(
          currentCompiled,
          'self-custody-vault',
          'unvaultDelaySeconds',
        )));

    if (delaySeconds === undefined) {
      throw new Error('Could not read Self-Custody Vault state from template');
    }

    const hasSavedSelfCustodyArgs = Boolean(
      currentArgs['hotKey'] || currentArgs['coldKey'],
    );
    const currentValues = {
      hotKey: currentArgs['hotKey'] || '',
      coldKey: currentArgs['coldKey'] || '',
      whitelistedDestinations: currentArgs['whitelistedDestinations'] || '',
      whitelistedDestinations_mode:
        currentArgs['whitelistMode'] === 'whitelist' ? 'whitelist' : 'anywhere',
      initUnvaultDelaySeconds: String(delaySeconds),
      initPhase: String(phase),
    };
    const constructorArgs = [
      hasSavedSelfCustodyArgs
        ? this.templateService.bytesArg(
            this.templatePatcher.kaspaAddressToPubkeyBytes(
              currentValues.hotKey,
            ),
          )
        : bytesArgFor('hotKey'),
      hasSavedSelfCustodyArgs
        ? this.templateService.bytesArg(
            this.templatePatcher.kaspaAddressToPubkeyBytes(
              currentValues.coldKey,
            ),
          )
        : bytesArgFor('coldKey'),
      hasSavedSelfCustodyArgs
        ? this.templateService.pubkeyListArg('whitelistedDestinations', currentValues)
        : bytesArgFor('whitelistedDestinations'),
      hasSavedSelfCustodyArgs
        ? this.templateService.intArg(this.templateService.getWhitelistCountFromValues(currentValues))
        : bytesArgFor('whitelistCount'),
      this.templateService.intArg(Number(delaySeconds)),
      this.templateService.intArg(phase),
    ];
    const patched = this.templatePatcher.applyPatch(baseCompiled, descriptor, [
      ...constructorArgs,
    ]) as CompiledContract;
    patched.tn10 = {
      v: 1,
      tmpl: 'SelfCustodyVault',
      args: this.templateService.buildSelfCustodyArgsPayload(currentValues),
    };
    this.templateService.logSelfCustodyContractParams('compiled continuation', {
      phase,
      currentTn10: currentCompiled.tn10,
      nextTn10: patched.tn10,
      delaySeconds,
      constructorArgs,
      currentAddress: this.covenantService.getContractAddress(currentCompiled),
      nextAddress: this.covenantService.getContractAddress(patched),
      scriptLength: patched.script?.length,
    });

    return patched;
  }

  private async extractDmsPubkeyHex(
    compiled: CompiledContract,
    field: 'owner' | 'heir',
  ): Promise<string | undefined> {
    if (field === 'owner') {
      return this.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'owner',
      );
    }

    return (
      (await this.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'initHeir',
      )) ||
      (await this.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'heir',
      ))
    );
  }

  private buildDmsPayloadHex(values: {
    ownerAddress: string;
    heirAddress: string;
    deadlineMs: bigint;
  }): string {
    return this.stringToHex(
      JSON.stringify({
        tn10: {
          v: 1,
          tmpl: 'DeadManSwitch',
          args: [
            { name: 'owner', type: 'address', value: values.ownerAddress },
            { name: 'heir', type: 'address', value: values.heirAddress },
            {
              name: 'checkInDeadline',
              type: 'blueScore',
              value: values.deadlineMs.toString(),
            },
          ],
        },
      }),
    );
  }

  private buildSelfCustodyPayloadHex(
    compiled: CompiledContract,
    initPhaseOverride?: number,
  ): string {
    if (!compiled.tn10) {
      throw new Error(
        'Self-Custody Vault continuation is missing TN10 metadata',
      );
    }
    const tn10 = JSON.parse(JSON.stringify(compiled.tn10));
    if (initPhaseOverride !== undefined) {
      if (Array.isArray(tn10.args)) {
        const phaseArg = tn10.args.find(
          (arg: any) => arg?.name === 'initPhase',
        );
        if (phaseArg) {
          phaseArg.value = String(initPhaseOverride);
        } else {
          tn10.args.push({
            name: 'initPhase',
            type: 'int',
            value: String(initPhaseOverride),
          });
        }
      } else if (tn10.args && typeof tn10.args === 'object') {
        tn10.args.p = String(initPhaseOverride);
      }
    }
    const payloadJson = JSON.stringify({ tn10 });
    console.log('[SelfCustodyVault] transaction payload', {
      initPhaseOverride,
      payloadJson,
      payloadHex: this.stringToHex(payloadJson),
    });
    return this.stringToHex(payloadJson);
  }

  private stringToHex(value: string): string {
    return Array.from(new TextEncoder().encode(value))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
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
    extraArgs?: Record<string, CovenantFunctionArg>,
    covenantId?: string,
    useSenderFee = false,
    transactionPayloadHex?: string,
  ): Promise<CovenantSpendActionResult | undefined> {
    if (compiled.contract_name === 'SelfCustodyVault') {
      this.templateService.logSelfCustodyContractParams('spend action parameters', {
        functionName,
        outpoint,
        inputAmountSompi,
        outputs,
        extraArgs,
        covenantId,
        useSenderFee,
        transactionPayloadHex,
        contractAddress: this.covenantService.getContractAddress(compiled),
        tn10: compiled.tn10,
      });
    }

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
      const utxoResponse = await rpc.getUtxosByAddresses({
        addresses: [address],
      });
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
    if (!result || (result.utxos || []).length === 0) return;
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

  /**
   * Builds a share link that carries only the network and canonical covenant
   * ID — never private data or compiled JSON. The receiving wallet imports
   * current state from the indexer when the link is opened.
   */
  buildShareLink(covenantId: string): string {
    return this.display.buildShareLink(covenantId);
  }

  copyContractShareLink(contract: ContractDashboardEntry) {
    const id = contract.covenantId;
    if (!id) return;
    const link = this.buildShareLink(id);
    navigator.clipboard.writeText(link).then(
      () =>
        this.notificationService.success(
          'Copied',
          'Contract share link copied.',
        ),
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
      label: `${contract.displayName} - ${contract.contractTypeLabel} - ${contract.covenantId}`,
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
      () =>
        this.notificationService.success(
          'Copied',
          'Contract share link copied.',
        ),
      () => prompt('Copy this contract link:', link),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  private readonly REDEPLOY_FUNCTIONS = new Set([
    'keepAlive',
    'increment',
    'unvault',
  ]);

  isTopUpFunction(fnName: string): boolean {
    return fnName === 'topUp';
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

  isDmsChangeHeir(): boolean {
    const contract = this.parsedInteractContract();
    if (!contract || this.selectedFunction !== 'changeHeir') return false;
    return (contract.contract_name || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .includes('deadman');
  }

  isSelfCustodyUnvault(): boolean {
    const contract = this.parsedInteractContract();
    return (
      this.selectedFunction === 'unvault' &&
      contract?.contract_name === 'SelfCustodyVault'
    );
  }

  /**
   * Returns true when the current function is DMS claim. Claim always
   * transfers the full balance to the heir — there's no continuation output,
   * so unlike a regular withdrawal it can't be partial.
   */
  isDmsClaim(): boolean {
    const contract = this.parsedInteractContract();
    if (!contract || this.selectedFunction !== 'claim') return false;
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
   * Whether this contract has *any* multi-sig entrypoint — gates the
   * "Complete co-signer transaction" section, which is only relevant for
   * contracts that can produce a partial spend in the first place (e.g. a
   * plain Dead Man's Switch or single-sig Escrow release has nothing for a
   * co-signer to complete).
   */
  contractHasMultiSigFunction(): boolean {
    return this.availableFunctions().some((fn) =>
      this.isMultiSigFunction(fn.name),
    );
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
      !this.isDmsChangeHeir()
    );
  }

  isSelfCustodySweepAction(
    fnName: string | undefined = this.selectedFunction,
  ): boolean {
    return (
      !!fnName &&
      ['emergencySweep', 'finalize'].includes(fnName) &&
      this.parsedInteractContract()?.contract_name === 'SelfCustodyVault'
    );
  }

  isSenderFeeToggleDisabled(
    fnName: string | undefined = this.selectedFunction,
  ): boolean {
    return (
      this.isInteracting() ||
      this.isMultiSigFunction(fnName || '') ||
      this.isSelfCustodySweepAction(fnName)
    );
  }

  getSenderFeeTooltip(
    fnName: string | undefined = this.selectedFunction,
  ): string {
    if (this.isMultiSigFunction(fnName || '')) {
      return 'Disabled for multi-sig signing. The contract must pay fees because wallet fee inputs would change the transaction after signatures are created.';
    }
    if (this.isSelfCustodySweepAction(fnName)) {
      return 'Required for Self-Custody sweep/finalize. The covenant requires the withdrawal output to keep the full input value, so fees must be paid by the wallet.';
    }
    if (this.isTopUpFunction(fnName || '')) {
      return 'When enabled, fees are paid from wallet change. When disabled, fees are deducted from the top-up output.';
    }
    return 'If enabled, transaction fees will be paid from your wallet balance instead of the contract funds.';
  }

  /**
   * Select an entrypoint function — clears stale state and auto-fills
   * output fields based on the function type.
   */
  selectFunction(name: string) {
    this.selectedFunction = name;
    this.useSenderFee =
      this.isSelfCustodySweepAction(name) || !this.isMultiSigFunction(name);

    // Clear stale interaction state
    this.interactError.set(null);
    this.interactResult.set(null);
    this.interactIndexerState.set(null);
    this.partialSpendJson.set(null);
    this.extraArgValues = {};
    this.dmsNewExpiry = '';
    this.topUpAmount = '';
    if (
      ['emergencySweep', 'finalize'].includes(name) &&
      this.parsedInteractContract()?.contract_name === 'SelfCustodyVault'
    ) {
      const whitelist = this.getSelfCustodyInteractWhitelistWallets();
      this.extraArgValues['destinationIndex'] = '0';
      if (whitelist.length > 0) {
        this.interactOutputAddress = whitelist[0];
        this.interactResolvedOutputAddress = null;
      }
    }

    if (this.isTopUpFunction(name) || this.isDmsChangeHeir()) {
      this.interactOutputAddress = '';
      this.interactOutputAmount = '';
    } else if (this.functionRequiresOutput(name)) {
      // Withdrawal function: default output to user's wallet, clear amount
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
      if (this.isSelfCustodySweepAction(name)) {
        const whitelist = this.getSelfCustodyInteractWhitelistWallets();
        if (whitelist.length > 0) {
          this.interactOutputAddress = whitelist[0];
          this.interactResolvedOutputAddress = null;
          this.extraArgValues['destinationIndex'] = '0';
        }
        const inputSompi = this.interactInputAmount;
        if (inputSompi) {
          try {
            this.interactOutputAmount = (Number(BigInt(inputSompi)) / 1e8)
              .toFixed(8)
              .replace(/\.?0+$/, '');
          } catch {
            this.interactOutputAmount = '';
          }
        } else {
          this.interactOutputAmount = '';
        }
      } else {
        this.interactOutputAmount = '';
      }
    } else if (this.isSelfCustodyUnvault()) {
      this.interactOutputAddress = '';
      this.interactOutputAmount = '';
      // Curated actions whose field config omits an amount field (e.g. DMS
      // claim) always withdraw the full balance — there's no input for the
      // user to fill in, so fill it in for them instead of leaving it empty.
      // (getSelectedActionFieldConfig() already reflects `name` — it was
      // just assigned to selectedFunction above.)
      const config = this.getSelectedActionFieldConfig();
      const hasAmountField =
        config?.fields.some((f) => f.type === 'amount') ?? true;
      if (!hasAmountField) {
        this.fillMaxOutputAmount();
      }
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
   * Return from a curated action's full-page form back to the action list —
   * resets the per-action transient fields (mirroring the reset block in
   * selectFunction()) plus the function selection itself. Leaves the loaded
   * contract JSON/outpoint untouched since it's the same contract.
   */
  goBackToActionList() {
    this.actionPageView.set('list');
    this.selectedFunction = '';
    this.interactError.set(null);
    this.interactResult.set(null);
    this.partialSpendJson.set(null);
    this.extraArgValues = {};
    this.dmsNewExpiry = '';
    this.topUpAmount = '';
  }

  /**
   * Get human-readable label for a function
   */
  getFunctionLabel(name: string): string {
    const labels: Record<string, string> = {
      spend: 'Withdraw',
      spend12: '2-of-3 Withdraw (Signer 1 + 2)',
      spend13: '2-of-3 Withdraw (Signer 1 + 3)',
      spend23: '2-of-3 Withdraw (Signer 2 + 3)',
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
      unvault: 'Start Unvault',
      emergencySweep: 'Emergency Sweep',
      finalize: 'Finalize',
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
        claim:
          'Claim the inheritance. Only available if the owner missed their keepAlive deadline.',
        changeHeir:
          'Change the beneficiary who can claim the funds if you miss the deadline.',
      },
      escrow: {
        release:
          'Both buyer and seller agree to release funds to the recipient.',
        refund:
          'Cancel the escrow and return funds to the sender. May require timelock expiry.',
      },
      multisigvault: {
        spend12:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 1 and Signer 2.',
        spend13:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 1 and Signer 3.',
        spend23:
          'Withdraw using 2-of-3 multi-sig. Requires signatures from Signer 2 and Signer 3.',
      },
      counter: {
        increment:
          'Increment the on-chain counter. The contract is re-deployed with the updated state.',
      },
      kcc20: {
        transfer:
          'Transfer KCC20 tokens to another user. Enter the recipient Kaspa address and the token amount to send. Both UTXOs remain locked in the covenant.',
      },
      selfcustodyvault: {
        topUp: 'Add KAS to the locked vault without changing its phase.',
        unvault:
          'Start the delayed withdrawal phase using the hot wallet. Funds stay in the vault.',
        emergencySweep:
          'Sweep funds with the cold wallet. If a whitelist is active, the destination index must match the recipient.',
        finalize:
          'Complete a hot-wallet withdrawal after the unvault delay. If a whitelist is active, the destination index must match the recipient.',
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
      unvault:
        'Move the vault into its delayed withdrawal phase without sending funds externally.',
      emergencySweep: 'Withdraw with the cold wallet.',
      finalize: 'Finalize a delayed withdrawal.',
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

  onInteractOutputAmountChange(value: any) {
    this.interactOutputAmount =
      value === null || value === undefined ? '' : String(value);
    this.interactError.set(null);
  }

  // ─── Generic action-page field delegators ──────────────────────────────
  // ContractActionFieldsComponent doesn't know which contract/action is
  // active — it just forwards raw value changes here, and these route to
  // the same state/handlers the fields already used inline.

  onGenericAddressChange(value: string) {
    this.onInteractOutputAddressChange(value);
  }

  onGenericAddressResolved(result: any) {
    this.onInteractOutputAddressResolved(result);
  }

  onGenericAddressQrClick() {
    this.onInteractOutputQrClick();
  }

  onGenericAmountChange(value: string) {
    if (this.isTopUpFunction(this.selectedFunction)) {
      this.onTopUpAmountChange(value);
    } else {
      this.onInteractOutputAmountChange(value);
    }
  }

  onGenericAmountMaxClick() {
    this.fillMaxOutputAmount();
  }

  onGenericTimestampChange(value: string) {
    this.dmsNewExpiry = value || '';
  }

  onGenericExtraArgChange(event: { name: string; value: string }) {
    this.onExtraArgValueChange(event.name, event.value);
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
    this.interactIndexerState.set(null);

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
          await this.updateRegistryContract(this.selectedContractId(), {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: continuationOutputIndex },
            amountSompi: partial.outputs[continuationOutputIndex].amountSompi,
          });
        } else {
          await this.updateRegistryContract(this.selectedContractId(), {
            status: 'spent',
            spendTxid: result.txid,
            lastChecked: Date.now(),
          });
        }
        void this.trackActionIndexing(result.txid, this.selectedContractId());
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
   * Surface the freshly-signed partial spend JSON in a dialog (copy-paste is
   * awkward from an inline textarea buried in the form) and return to the
   * contracts list once the co-signer has what they need.
   */
  private openPartialSpendJsonDialog(json: string) {
    this.dialog
      .open<void, PartialSpendJsonDialogData>(PartialSpendJsonModalComponent, {
        data: {
          title: 'Partial spend created',
          showCloseButton: true,
          json,
        },
      })
      .closed.subscribe(() => this.backToContractsList());
  }

  /**
   * Copy partial spend JSON to clipboard
   */
  copyPartialSpend() {
    const json = this.partialSpendJson();
    if (!json) return;
    navigator.clipboard.writeText(json).then(
      () =>
        this.notificationService.success(
          'Copied',
          'Partial spend JSON copied! Send it to the co-signer.',
        ),
      () => prompt('Copy this partial spend JSON:', json),
    );
  }

  /**
   * Download the pending partial spend JSON as a .json file.
   */
  downloadPartialSpend() {
    const json = this.partialSpendJson();
    if (!json) return;
    downloadJsonFile(json, 'partial-spend');
  }

  /**
   * Open a file picker and load a co-signer's partial spend JSON into the
   * import textarea.
   */
  importPartialSpendFromFile() {
    readJsonFile((content) => {
      this.importPartialJson = content;
    });
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
   * Scan the compiled script for 32-byte pubkey pushes (OP_DATA_32 = 0x20) and
   * return the first two, in first-appearance order (buyer, then seller —
   * both callers only ever read indices 0 and 1).
   *
   * Deliberately NOT deduplicated by value: buyer and seller are separate
   * constructor slots that can legitimately hold the same pubkey (e.g. one
   * wallet acting as both parties). Deduping by hex value would collapse
   * that into a single entry and shift index [1] onto the next distinct
   * 32-byte push in the script — arbiterHash — silently sending funds to a
   * bogus derived address instead of the seller.
   */
  private extractPubkeysFromScript(compiled: CompiledContract): string[] {
    const scriptBytes = Uint8Array.from(compiled.script);
    const found: string[] = [];
    // Advance past each consumed push's data instead of scanning every byte
    // offset — otherwise a stray 0x20 byte inside a real pubkey's own 32
    // bytes gets misread as a second push opcode, splicing in a bogus
    // "pubkey" ahead of the real next one and shifting the buyer/seller
    // indices this function's callers rely on.
    for (let i = 0; i <= scriptBytes.length - 33 && found.length < 2;) {
      if (scriptBytes[i] === 0x20) {
        const pkHex = Array.from(scriptBytes.slice(i + 1, i + 33))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        found.push(pkHex);
        i += 33;
        continue;
      }
      i += 1;
    }
    return found;
  }

  /**
   * Convert an x-only 32-byte pubkey hex into a Kaspa P2PK address for the current network.
   */
  private pubkeyToAddress(pkHex: string): string {
    return this.templateService.pubkeyToAddress(pkHex);
  }
}
