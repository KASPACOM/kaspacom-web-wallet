import { Injectable, inject } from '@angular/core';
import { CovenantService } from '../../../../../../services/covenant/covenant.service';
import {
  CovenantIndexerService,
  IndexerCovenantAction,
  IndexerCovenantArg,
  IndexerCovenantDetails,
  IndexerCovenantResponse,
} from '../../../../../../services/covenant/covenant-indexer.service';
import { ContractRegistryEntry } from '../../../../../../services/covenant/contract-registry.service';
import { CompiledContract } from '../../../../../../services/covenant/covenant-sdk/types';
import {
  ContractDashboardEntry,
  ContractParticipant,
} from '../contracts-page.models';
import { ContractDisplayService } from './contract-display.service';
import { CovenantTemplateService } from './covenant-template.service';

/**
 * Context the dashboard-building methods need but don't own themselves —
 * wallet identity, network, and the registry snapshots the shell already
 * holds as signals. Passed in explicitly (rather than read from injected
 * signals) so this service stays a plain stateless data layer.
 */
export interface ContractsDashboardBuildContext {
  localRegistryContracts: ContractRegistryEntry[];
  allRegistryContracts: ContractRegistryEntry[];
  network: string;
  walletKey?: string;
  /** Lowercased address/pubkey/pubkeyHash values used to match the current wallet against participants. */
  currentRoleCandidates: string[];
}

/**
 * Stateless normalization/fetch layer for the Contracts dashboard: turns
 * registry entries and indexer responses into ContractDashboardEntry rows,
 * merges the two sources, and resolves indexer covenant lookups. Shared by
 * the dashboard load pipeline and (not-yet-extracted) lookup/import and
 * detail code, which is why it lives here rather than only serving one tab.
 */
@Injectable({
  providedIn: 'root',
})
export class ContractsDataService {
  private covenantService = inject(CovenantService);
  private covenantIndexerService = inject(CovenantIndexerService);
  private display = inject(ContractDisplayService);
  private templateService = inject(CovenantTemplateService);

  private localParticipantsCache = new Map<
    string,
    Promise<ContractParticipant[]>
  >();
  private readonly INDEXER_ACTION_FETCH_CONCURRENCY = 5;

  clearLocalParticipantsCache(): void {
    this.localParticipantsCache.clear();
  }

  // --- identity / sorting ---

  normalizeIdentity(value?: string): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  sameIdentity(left?: string, right?: string): boolean {
    const normalizedLeft = this.normalizeIdentity(left);
    const normalizedRight = this.normalizeIdentity(right);
    return !!normalizedLeft && normalizedLeft === normalizedRight;
  }

  private getDashboardIdentityKey(entry: ContractDashboardEntry): string {
    return (
      this.normalizeIdentity(entry.covenantId) ||
      this.normalizeIdentity(entry.deployTxid) ||
      this.normalizeIdentity(entry.scriptHash) ||
      entry.id
    );
  }

  private getEntryTime(entry: ContractDashboardEntry): number {
    return (
      entry.registryEntry?.deployedAt || entry.indexerSummary?.createdAtMs || 0
    );
  }

  sortDashboardEntries(
    entries: ContractDashboardEntry[],
  ): ContractDashboardEntry[] {
    return [...entries].sort(
      (a, b) =>
        this.getEntryTime(b) - this.getEntryTime(a) || b.id.localeCompare(a.id),
    );
  }

  statusFromActiveUtxoCount(
    activeUtxos: number | undefined,
  ): ContractDashboardEntry['status'] {
    if (activeUtxos === 0) return 'spent';
    if (activeUtxos === 1) return 'active';
    return 'tracking-incomplete';
  }

  extractDeadlineMs(
    summary: IndexerCovenantDetails,
    utxoState?: Record<string, any> | null,
  ): number | undefined {
    const source = {
      ...(summary.constructor || {}),
      ...this.templateService.argsArrayToRecord(
        summary.claimedArgs?.args || [],
      ),
      ...(utxoState || {}),
    };
    const raw =
      source['deadline'] ??
      source['initDeadline'] ??
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

  getIndexerTemplateName(summary: IndexerCovenantDetails): string {
    return this.display.normalizeContractName(
      summary.template ||
        summary.claimedTemplate ||
        summary.claimedArgs?.tmpl ||
        'Covenant',
    );
  }

  // --- roles / next action ---

  rolesForCandidates(
    participants: ContractParticipant[] = [],
    candidates: string[],
  ): string[] {
    const safeParticipants = Array.isArray(participants) ? participants : [];
    return safeParticipants
      .filter(
        (participant) =>
          participant &&
          [participant.value, ...(participant.matchValues || [])]
            .map((value) => String(value).toLowerCase())
            .some((value) => candidates.includes(value)),
      )
      .map((participant) => participant.label)
      .filter((label): label is string => !!label);
  }

  getNextActionLabel(
    contractName: string,
    status: ContractDashboardEntry['status'],
    currentRoles: string[],
  ): string {
    if (status !== 'active') return 'View history';
    const normalized = this.display.normalizeContractName(contractName);
    if (normalized === 'DeadManSwitch')
      return currentRoles.includes('Owner') ? 'Keep Alive' : 'Claim';
    if (normalized === 'TimeLockVault')
      return currentRoles.includes('Recovery') ? 'Recover' : 'Withdraw';
    if (normalized === 'MultiSigVault')
      return currentRoles.some((role) => role.startsWith('Signer'))
        ? 'Sign / Complete'
        : 'Open Actions';
    if (normalized === 'EscrowWithArbiter') {
      if (currentRoles.includes('Arbiter')) return 'Arbitrate';
      if (currentRoles.includes('Buyer')) return 'Release / Refund';
      if (currentRoles.includes('Seller')) return 'Release';
    }
    if (normalized === 'SelfCustodyVault') {
      if (currentRoles.includes('Cold wallet')) return 'Emergency Sweep';
      if (currentRoles.includes('Hot wallet')) return 'Unvault / Finalize';
    }
    return 'Open Actions';
  }

  // --- alias / display name ---

  getContractAliasOwnerKey(
    contract: { aliases?: Record<string, string> },
    walletKey?: string,
  ): string | undefined {
    if (walletKey && contract.aliases?.[walletKey]) {
      return walletKey;
    }
    return Object.entries(contract.aliases || {}).find(([, alias]) =>
      Boolean(alias),
    )?.[0];
  }

  getContractAlias(
    contract: { aliases?: Record<string, string> },
    walletKey?: string,
  ): string | undefined {
    const ownerKey = this.getContractAliasOwnerKey(contract, walletKey);
    return ownerKey ? contract.aliases?.[ownerKey] : undefined;
  }

  getContractDisplayName(
    contract: { contractName?: string; aliases?: Record<string, string> },
    walletKey?: string,
  ): string {
    return (
      this.getContractAlias(contract, walletKey) ||
      this.display.getContractTypeLabel(contract)
    );
  }

  withDashboardName(
    entry: ContractDashboardEntry,
    walletKey?: string,
  ): ContractDashboardEntry {
    const contractTypeLabel = this.display.getContractTypeLabel(entry);
    const aliasName = this.getContractAlias(entry, walletKey);
    return {
      ...entry,
      participants: Array.isArray(entry.participants)
        ? entry.participants.filter(Boolean)
        : [],
      aliasName,
      contractTypeLabel,
      displayName: aliasName || contractTypeLabel,
    };
  }

  // --- registry lookup ---

  findSavedRegistryEntryForIdentity(
    input: {
      covenantId?: string;
      deployTxid?: string;
      outpoint?: { txid: string; vout: number };
    },
    allRegistryContracts: ContractRegistryEntry[],
    network: string,
  ): ContractRegistryEntry | undefined {
    return allRegistryContracts.find(
      (entry) =>
        entry.network === network &&
        ((input.covenantId &&
          this.sameIdentity(entry.covenantId, input.covenantId)) ||
          (input.deployTxid &&
            this.sameIdentity(entry.deployTxid, input.deployTxid)) ||
          (input.outpoint &&
            this.sameIdentity(entry.outpoint?.txid, input.outpoint.txid) &&
            entry.outpoint?.vout === input.outpoint.vout)),
    );
  }

  // --- participants ---

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      owner: 'Owner',
      heir: 'Heir',
      initRecovery: 'Recovery',
      signer: 'Owner',
      recovery: 'Recovery',
      recoveryKey: 'Recovery',
      key1: 'Signer 1',
      key2: 'Signer 2',
      key3: 'Signer 3',
      signer1: 'Signer 1',
      signer2: 'Signer 2',
      signer3: 'Signer 3',
      buyer: 'Buyer',
      seller: 'Seller',
      arbiter: 'Arbiter',
      arbiterHash: 'Arbiter',
      hotKey: 'Hot wallet',
      coldKey: 'Cold wallet',
      whitelistedDestinations: 'Whitelist',
    };
    return labels[role] || role;
  }

  getParticipantDisplayValue(
    role: string,
    value: string,
    type?: string,
  ): { label: string; value: string } {
    const label = this.roleLabel(role);
    const normalizedType = String(type || '').toLowerCase();
    const isHex32 = /^[0-9a-f]{64}$/i.test(value);
    if (!isHex32) return { label, value };

    const address = normalizedType.includes('hash')
      ? ''
      : this.templateService.pubkeyToAddress(value);
    if (address) return { label, value: address };

    return { label, value: '' };
  }

  normalizeIndexerArgs(rawArgs: unknown): IndexerCovenantArg[] {
    const aliases: Record<string, { name: string; type: string }> = {
      h: { name: 'hotKey', type: 'address' },
      c: { name: 'coldKey', type: 'address' },
      m: { name: 'whitelistMode', type: 'string' },
      w: { name: 'whitelistedDestinations', type: 'address[]' },
      d: { name: 'unvaultDelaySeconds', type: 'blueScore' },
      p: { name: 'initPhase', type: 'int' },
    };
    const expand = (key: string, value: unknown, type = '') => {
      const alias = aliases[key];
      return {
        name: alias?.name || key,
        type: alias?.type || type || 'string',
        value:
          key === 'm'
            ? value === 'w'
              ? 'whitelist'
              : 'anywhere'
            : String(value ?? ''),
      };
    };

    if (Array.isArray(rawArgs)) {
      return rawArgs.map((arg: any) =>
        expand(
          String(arg?.name ?? arg?.n ?? ''),
          arg?.value ?? arg?.v ?? '',
          String(arg?.type ?? arg?.t ?? ''),
        ),
      );
    }

    if (rawArgs && typeof rawArgs === 'object') {
      return Object.entries(rawArgs).map(([key, value]) => expand(key, value));
    }

    return [];
  }

  mergeParticipants(
    localParticipants: ContractParticipant[] | undefined,
    indexerParticipants: ContractParticipant[] | undefined,
  ): ContractParticipant[] {
    const merged: ContractParticipant[] = [];
    const seen = new Set<string>();
    for (const participant of [
      ...(localParticipants || []),
      ...(indexerParticipants || []),
    ]) {
      if (!participant) continue;
      const identityValue =
        participant.value || participant.matchValues?.join('|') || '';
      const key = `${participant.label}:${identityValue.toLowerCase()}`;
      if (!identityValue || seen.has(key)) continue;
      seen.add(key);
      merged.push(participant);
    }
    return merged;
  }

  indexerParticipants(summary: IndexerCovenantDetails): ContractParticipant[] {
    const source = {
      ...(summary.constructor || {}),
      ...this.templateService.argsArrayToRecord(
        this.normalizeIndexerArgs(summary.claimedArgs?.args),
      ),
    };
    const roles = [
      'owner',
      'heir',
      'signer',
      'initRecovery',
      'recovery',
      'recoveryKey',
      'key1',
      'key2',
      'key3',
      'signer1',
      'signer2',
      'signer3',
      'buyer',
      'seller',
      'arbiter',
      'arbiterHash',
      'hotKey',
      'coldKey',
    ];
    return roles
      .filter(
        (role) =>
          source[role] !== undefined &&
          source[role] !== null &&
          source[role] !== '',
      )
      .map((role) => {
        const rawValue = String(source[role]);
        const display = this.getParticipantDisplayValue(role, rawValue);
        return {
          ...display,
          matchValues: display.value === rawValue ? undefined : [rawValue],
          hidden: !display.value,
        };
      });
  }

  private async localTemplateParticipants(
    compiled: CompiledContract,
  ): Promise<ContractParticipant[]> {
    const template = this.templateService.templateForIndexerName(
      compiled.contract_name,
    );
    if (!template) return [];

    const roleParamsByTemplate: Record<string, string[]> = {
      'dead-mans-switch': ['owner', 'heir'],
      'time-lock-vault': ['owner', 'initRecovery'],
      'multi-sig-vault': ['key1', 'key2', 'key3'],
      'escrow-with-arbiter': ['buyer', 'seller', 'arbiterHash'],
    };
    const roleParams = roleParamsByTemplate[template.id] || [];
    const participants: ContractParticipant[] = [];

    for (const paramName of roleParams) {
      const field = template.fields.find(
        (item) =>
          item.paramName === paramName ||
          (paramName === 'initRecovery' && item.paramName === 'recovery'),
      );
      if (!field) continue;
      const value =
        field.type === 'hash32'
          ? await this.templateService.extractTemplateParamHex(
              compiled,
              template.id,
              paramName,
              'byte[32]',
            )
          : await this.templateService.extractTemplateParamHex(
              compiled,
              template.id,
              paramName,
              'pubkey',
            );
      if (!value) continue;
      const label = this.roleLabel(paramName);
      const address =
        field.type === 'hash32'
          ? ''
          : this.templateService.pubkeyToAddress(value);
      if (address) {
        participants.push({ label, value: address, matchValues: [value] });
      } else {
        participants.push({
          label,
          value: '',
          matchValues: [value],
          hidden: true,
        });
      }
    }

    return participants;
  }

  private localSelfCustodyParticipants(
    contract: ContractRegistryEntry,
  ): Array<{ label: string; value: string }> {
    if (
      this.display.normalizeContractName(contract.contractName) !==
      'SelfCustodyVault'
    ) {
      return [];
    }

    try {
      const compiled = this.covenantService.parseCompiledContract(
        contract.compiledJson,
      );
      const args = this.templateService.argsArrayToRecord(
        compiled.tn10?.args || [],
      );
      const hotKey = args['hotKey'];
      const coldKey = args['coldKey'];
      const participants: Array<{ label: string; value: string }> = [];
      if (hotKey) {
        participants.push({ label: 'Hot wallet', value: hotKey });
      }
      if (coldKey) {
        participants.push({ label: 'Cold wallet', value: coldKey });
      }
      return participants;
    } catch {
      return [];
    }
  }

  private async buildLocalParticipants(
    contract: ContractRegistryEntry,
    predecessor?: ContractRegistryEntry,
  ): Promise<ContractParticipant[]> {
    try {
      const compiled = this.covenantService.parseCompiledContract(
        contract.compiledJson,
      );
      const templateParticipants =
        await this.localTemplateParticipants(compiled);
      if (templateParticipants.length > 0) return templateParticipants;
    } catch {
      // Fall back to deployer metadata for older or custom saved contracts.
    }

    const selfCustodyParticipants = this.localSelfCustodyParticipants(contract);
    if (selfCustodyParticipants.length > 0) {
      return selfCustodyParticipants;
    }

    const participants: ContractParticipant[] = [];
    const deployedByValue =
      contract.deployedBy.address || contract.deployedBy.pubkey;
    if (deployedByValue) {
      participants.push({ label: 'Owner', value: deployedByValue });
    }
    if (
      predecessor?.deployedBy?.address &&
      predecessor.deployedBy.address !== contract.deployedBy.address
    ) {
      const participant = {
        label: 'Original owner',
        value: predecessor.deployedBy.address,
      };
      if (participants.length > 0) {
        if (
          !participants.some(
            (existing) =>
              existing.label === participant.label &&
              existing.value === participant.value,
          )
        ) {
          participants.push(participant);
        }
      } else {
        participants.push(participant);
      }
    }
    return participants;
  }

  localParticipants(
    contract: ContractRegistryEntry,
    predecessor?: ContractRegistryEntry,
  ): Promise<ContractParticipant[]> {
    const cacheKey = `${contract.id}:${contract.compiledJson}`;
    const cached = this.localParticipantsCache.get(cacheKey);
    if (cached) return cached;

    const promise = this.buildLocalParticipants(contract, predecessor);
    this.localParticipantsCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * `spendTxid` only covers a terminal full withdrawal; continuation actions
   * record their local action metadata when broadcast so the dashboard can show
   * that optimistic latest action until the indexer catches up.
   */
  private localLatestAction(contract: ContractRegistryEntry): {
    latestTxid?: string;
    latestAction?: string;
    latestActionAtMs?: number;
  } {
    if (contract.lastActionType) {
      return {
        latestTxid: contract.lastActionTxid || contract.outpoint?.txid,
        latestAction: contract.lastActionType,
        latestActionAtMs: contract.lastActionAt,
      };
    }
    return {
      latestTxid:
        contract.spendTxid || contract.outpoint?.txid || contract.deployTxid,
      latestAction: contract.spendTxid ? 'spend' : 'deploy',
      latestActionAtMs: contract.spendTxid ? contract.lastChecked : undefined,
    };
  }

  /**
   * The indexer's claimedArgs snapshot is frozen at genesis and never
   * reflects a covenant's later continuations (e.g. a keepAlive's extended
   * deadline). For contracts this wallet has a local compiled JSON for, read
   * the deadline straight from the current script bytes instead — the same
   * ground truth executeDmsKeepAlive() validates the new deadline against.
   */
  private async extractLocalDmsDeadlineMs(
    contract: ContractRegistryEntry,
    normalizedContractName: string,
  ): Promise<number | undefined> {
    if (normalizedContractName !== 'DeadManSwitch' || !contract.compiledJson) {
      return undefined;
    }
    try {
      const compiled = this.covenantService.parseCompiledContract(
        contract.compiledJson,
      );
      const deadline = await this.templateService.extractTemplateIntField(
        compiled,
        'dead-mans-switch',
        'initDeadline',
      );
      if (deadline === undefined) return undefined;
      const deadlineMs = Number(deadline);
      return Number.isFinite(deadlineMs) && deadlineMs > 0
        ? deadlineMs
        : undefined;
    } catch {
      return undefined;
    }
  }

  // --- dashboard entry building ---

  async localEntryToDashboard(
    contract: ContractRegistryEntry,
    ctx: ContractsDashboardBuildContext,
  ): Promise<ContractDashboardEntry> {
    const contractName = this.display.normalizeContractName(
      contract.contractName,
    );
    const predecessor = contract.predecessorId
      ? ctx.localRegistryContracts.find(
          (entry) => entry.id === contract.predecessorId,
        )
      : undefined;
    const participants = await this.localParticipants(contract, predecessor);
    const currentRoles = this.rolesForCandidates(
      participants,
      ctx.currentRoleCandidates,
    );
    return this.withDashboardName(
      {
        id: `local:${contract.id}`,
        source: 'local',
        contractName,
        displayName: this.display.getTemplateDisplayName(contractName),
        contractTypeLabel: this.display.getTemplateDisplayName(contractName),
        aliases: contract.aliases,
        status: contract.status || 'unknown',
        amountSompi: contract.amountSompi,
        currentAddress: contract.contractAddress,
        covenantId: contract.covenantId,
        deployTxid: contract.deployTxid,
        ...this.localLatestAction(contract),
        deadlineMs: await this.extractLocalDmsDeadlineMs(
          contract,
          contractName,
        ),
        participants,
        nextActionLabel: this.getNextActionLabel(
          contractName,
          contract.status || 'unknown',
          currentRoles,
        ),
        actionHint: 'Open wallet action flow',
        registryEntry: contract,
      },
      ctx.walletKey,
    );
  }

  indexerSummaryToDashboard(
    summary: IndexerCovenantDetails,
    ctx: ContractsDashboardBuildContext,
    latestAction?: IndexerCovenantAction,
  ): ContractDashboardEntry {
    const contractName = this.getIndexerTemplateName(summary);
    const participants = this.indexerParticipants(summary);
    const status = this.statusFromActiveUtxoCount(summary.activeUtxos);
    const registryEntry = this.findSavedRegistryEntryForIdentity(
      {
        covenantId: summary.covenantIdHex,
        deployTxid: summary.genesisTxidHex,
      },
      ctx.allRegistryContracts,
      ctx.network,
    );
    const currentRoles = this.rolesForCandidates(
      participants,
      ctx.currentRoleCandidates,
    );
    return this.withDashboardName(
      {
        id: `indexer:${summary.covenantIdHex || summary.scriptHashHex}`,
        source: 'indexer',
        contractName,
        displayName: this.display.getTemplateDisplayName(contractName),
        contractTypeLabel: this.display.getTemplateDisplayName(contractName),
        aliases: registryEntry?.aliases,
        status,
        amountSompi: String(summary.totalAmountSompi ?? '0'),
        currentAddress: summary.address,
        covenantId: summary.covenantIdHex,
        scriptHash: summary.scriptHashHex,
        deployTxid: summary.genesisTxidHex,
        latestTxid: latestAction?.txidHex || summary.genesisTxidHex,
        latestAction:
          latestAction?.entrypoint || latestAction?.action || 'deploy',
        latestActionAtMs: latestAction?.blockTimeMs,
        deadlineMs: this.extractDeadlineMs(summary),
        participants,
        nextActionLabel: this.getNextActionLabel(
          contractName,
          status,
          currentRoles,
        ),
        actionHint:
          summary.claimVerified === false
            ? 'Template claim is not verified on-chain yet'
            : 'Open current covenant state',
        registryEntry,
        indexerSummary: summary,
      },
      ctx.walletKey,
    );
  }

  private supportedIndexerTemplates = [
    'DeadManSwitch',
    'TimeLockVault',
    'MultiSigVault',
    'EscrowWithArbiter',
    'SelfCustodyVault',
  ];

  private async fetchLatestIndexerAction(
    summary: IndexerCovenantDetails,
  ): Promise<IndexerCovenantAction | undefined> {
    const identifier = summary.covenantIdHex || summary.scriptHashHex;
    if (!identifier) return undefined;
    try {
      const actions =
        await this.covenantIndexerService.getCovenantActions(identifier);
      return this.latestAction(actions);
    } catch (error) {
      console.warn(
        '[Contracts] Failed to load latest action for covenant',
        identifier,
        error,
      );
      return undefined;
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let index = 0; index < items.length; index += concurrency) {
      const batch = items.slice(index, index + concurrency);
      results.push(...(await Promise.all(batch.map(mapper))));
    }
    return results;
  }

  async loadIndexerDashboardEntries(
    identifiers: Array<string | undefined>,
    ctx: ContractsDashboardBuildContext,
  ): Promise<ContractDashboardEntry[]> {
    const safeIdentifiers = identifiers.filter(
      (value): value is string => !!value,
    );
    if (safeIdentifiers.length === 0) return [];

    const byKey = new Map<string, ContractDashboardEntry>();
    const rowsByIdentifier = await Promise.all(
      safeIdentifiers.map((identifier) =>
        this.covenantIndexerService.listCovenants({
          wallet: identifier,
          sort: 'recent',
          limit: 100,
        }),
      ),
    );

    for (const rows of rowsByIdentifier) {
      const filteredRows = rows
        .filter((row) =>
          this.supportedIndexerTemplates.includes(
            this.getIndexerTemplateName(row),
          ),
        );
      const entries = await this.mapWithConcurrency(
        filteredRows,
        this.INDEXER_ACTION_FETCH_CONCURRENCY,
        async (row) =>
          this.indexerSummaryToDashboard(
            row,
            ctx,
            await this.fetchLatestIndexerAction(row),
          ),
      );
      for (const entry of entries) {
        byKey.set(this.getDashboardIdentityKey(entry), entry);
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => this.getEntryTime(b) - this.getEntryTime(a),
    );
  }

  mergeDashboardEntries(
    indexerEntries: ContractDashboardEntry[],
    localEntries: ContractDashboardEntry[],
    walletKey?: string,
  ): ContractDashboardEntry[] {
    const merged = new Map<string, ContractDashboardEntry>();
    const hasAmount = (entry?: ContractDashboardEntry) =>
      BigInt(String(entry?.amountSompi || '0')) > 0n;
    const isMatch = (
      indexerEntry: ContractDashboardEntry,
      localEntry: ContractDashboardEntry,
    ) =>
      this.sameIdentity(indexerEntry.covenantId, localEntry.covenantId) ||
      this.sameIdentity(indexerEntry.deployTxid, localEntry.deployTxid) ||
      (!indexerEntry.covenantId &&
        !indexerEntry.deployTxid &&
        !localEntry.covenantId &&
        !localEntry.deployTxid &&
        this.sameIdentity(indexerEntry.scriptHash, localEntry.scriptHash));

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

      const localActionAtMs =
        local?.registryEntry?.lastActionType && local.registryEntry.lastActionAt
          ? local.registryEntry.lastActionAt
          : undefined;
      const preferLocalLatest =
        localActionAtMs !== undefined &&
        localActionAtMs > (entry.latestActionAtMs ?? 0);

      merged.set(
        local?.id || key,
        this.withDashboardName(
          {
            ...entry,
            id: local?.id || entry.id,
            source: local ? 'both' : entry.source,
            status: entry.status,
            amountSompi: entry.amountSompi,
            latestTxid: preferLocalLatest ? local?.latestTxid : entry.latestTxid,
            latestAction: preferLocalLatest
              ? local?.latestAction
              : entry.latestAction,
            latestActionAtMs: preferLocalLatest
              ? localActionAtMs
              : entry.latestActionAtMs,
            participants: this.mergeParticipants(
              local?.participants,
              entry.participants,
            ),
            deadlineMs: local?.deadlineMs ?? entry.deadlineMs,
            aliases: local?.aliases || entry.aliases,
            registryEntry: local?.registryEntry || entry.registryEntry,
          },
          walletKey,
        ),
      );
    }

    return Array.from(merged.values()).sort(
      (a, b) => this.getEntryTime(b) - this.getEntryTime(a),
    );
  }

  // --- indexer covenant resolution ---

  latestAction(
    actions: IndexerCovenantAction[],
  ): IndexerCovenantAction | undefined {
    return [...actions].sort(
      (a, b) => (b.blockTimeMs || 0) - (a.blockTimeMs || 0),
    )[0];
  }

  getLatestCovenantOutputAction(
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

  extractScriptHashFromScriptPubKey(
    scriptPubKeyHex: string | undefined,
  ): string | undefined {
    const normalized = scriptPubKeyHex?.trim().toLowerCase();
    if (!normalized) return undefined;

    // P2SH covenant output: OP_0/OP_PUSHDATA-ish prefix + 32-byte script hash + suffix.
    const match = normalized.match(/^aa20([0-9a-f]{64})87$/);
    return match?.[1];
  }

  async fetchIndexerCovenantByIdOrHash(
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

  async fetchIndexerCovenant(identifier: string): Promise<{
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
}
