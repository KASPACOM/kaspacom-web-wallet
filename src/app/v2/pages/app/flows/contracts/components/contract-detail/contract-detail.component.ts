import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  KcIconComponent,
  KcButtonComponent,
  NotificationService,
} from '@kaspacom/ui-kit';
import { WalletService } from '../../../../../../../services/wallet.service';
import { CovenantService } from '../../../../../../../services/covenant/covenant.service';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
import { WalletProfileOrbComponent } from '../../../../../../shared/ui/wallet-profile-orb/wallet-profile-orb.component';
import { downloadJsonFile } from '../../json-file.util';
import { hex32ToBytes, computeBlake2bHex } from '../../crypto.util';
import {
  ContractDashboardEntry,
  ContractDetailState,
  ContractParticipant,
  AvailableAction,
} from '../../contracts-page.models';
import { ContractDisplayService } from '../../services/contract-display.service';
import { CovenantTemplateService } from '../../services/covenant-template.service';
import { ContractsDataService } from '../../services/contracts-data.service';

@Component({
  selector: 'app-contract-detail',
  imports: [
    CommonModule,
    FormsModule,
    KcIconComponent,
    KcButtonComponent,
    CopyButtonComponent,
    WalletProfileOrbComponent,
  ],
  templateUrl: './contract-detail.component.html',
  styleUrl: './contract-detail.component.scss',
})
export class ContractDetailComponent {
  private walletService = inject(WalletService);
  private covenantService = inject(CovenantService);
  private templateService = inject(CovenantTemplateService);
  private contractsData = inject(ContractsDataService);
  private notificationService = inject(NotificationService);
  display = inject(ContractDisplayService);

  selectedDetail = input.required<ContractDetailState>();
  selectedDetailLoading = input(false);
  selectedDetailError = input<string | null>(null);
  actionPageView = input<'list' | 'form'>('list');
  actionsPanelReady = input(false);
  availableActions = input<AvailableAction[]>([]);
  partialSpendJsonForDetail = input<string | null>(null);
  editingAliasKey = input<string | null>(null);
  aliasNotice = input<{ key: string; message: string } | null>(null);
  walletKey = input<string | undefined>(undefined);

  actionRequested = output<string | undefined>();
  closeRequested = output<void>();
  shareRequested = output<ContractDashboardEntry>();
  aliasEditRequested = output<ContractDashboardEntry>();
  aliasEditCancelled = output<void>();
  aliasSaveRequested = output<{
    contract: ContractDashboardEntry;
    draft: string;
  }>();
  aliasRemoveRequested = output<ContractDashboardEntry>();

  aliasDraft = '';

  constructor() {
    effect(() => {
      const key = this.editingAliasKey();
      const entry = this.selectedDetail().entry;
      if (!key || this.getAliasEditKey(entry) !== key) {
        this.aliasDraft = '';
        return;
      }
      const currentWalletKey = this.walletKey();
      this.aliasDraft =
        (currentWalletKey ? entry.aliases?.[currentWalletKey] : '') ||
        entry.aliasName ||
        '';
    });
  }

  requestAction(fnName?: string) {
    this.actionRequested.emit(fnName);
  }

  close() {
    this.closeRequested.emit();
  }

  share(contract: ContractDashboardEntry) {
    this.shareRequested.emit(contract);
  }

  // ─── Alias editing (relayed to the shell — the same contract's editor
  // stays in sync whether opened from a dashboard card, the action panel,
  // or here) ────────────────────────────────────────────────────────────
  canEditContractAlias(contract: ContractDashboardEntry): boolean {
    return !!contract.registryEntry;
  }

  getAliasEditKey(contract: ContractDashboardEntry): string {
    return contract.registryEntry?.id || contract.id;
  }

  getAliasUnavailableMessage(): string {
    return 'Import this contract before adding a nickname.';
  }

  beginAliasEdit(contract: ContractDashboardEntry) {
    this.aliasEditRequested.emit(contract);
  }

  cancelAliasEdit() {
    this.aliasEditCancelled.emit();
  }

  saveAlias(contract: ContractDashboardEntry) {
    this.aliasSaveRequested.emit({ contract, draft: this.aliasDraft });
  }

  removeAlias(contract: ContractDashboardEntry) {
    this.aliasRemoveRequested.emit(contract);
  }

  // ─── Pending partial-spend card ─────────────────────────────────────
  copyPartialSpend() {
    const json = this.partialSpendJsonForDetail();
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

  downloadPartialSpend() {
    const json = this.partialSpendJsonForDetail();
    if (!json) return;
    downloadJsonFile(json, 'partial-spend');
  }

  // ─── Current wallet role ─────────────────────────────────────────────
  private currentWallet = () => this.walletService.getCurrentWallet();

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

  private currentWalletRoles(
    participants: ContractParticipant[] = [],
  ): string[] {
    return this.contractsData.rolesForCandidates(
      participants,
      this.currentWalletRoleCandidates(),
    );
  }

  /** The detail page's "You are <role>" pill. */
  getCurrentRoleLabel(participants: ContractParticipant[] = []): string {
    return this.currentWalletRoles(participants).join(' / ');
  }

  // ─── Self-Custody Vault phase / whitelist ───────────────────────────
  private localTemplateArgs(
    contract:
      | {
          compiledJson?: string;
        }
      | undefined,
  ): Array<{ name: string; value: string }> {
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

  private selfCustodyArgsForDetail(
    detail: ContractDetailState,
  ): Record<string, string> {
    const covenant = detail.response?.covenant || detail.entry.indexerSummary;
    const args: Record<string, string> = {
      ...this.templateService.argsArrayToRecord(
        this.contractsData.normalizeIndexerArgs(covenant?.claimedArgs?.args),
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
            this.contractsData.normalizeIndexerArgs(compiled.tn10?.args),
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
      this.display.normalizeContractName(detail.entry.contractName) !==
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

  getSelfCustodyPhaseInfo(detail: ContractDetailState): string | null {
    const phase = this.getSelfCustodyPhase(detail);
    if (phase === undefined) return null;
    if (phase === 0) return '0 - locked';
    if (phase === 1) return '1 - unvaulting';
    return `${phase} - unknown`;
  }

  private getSelfCustodyPhase(detail: ContractDetailState): number | undefined {
    if (
      this.display.normalizeContractName(detail.entry.contractName) !==
      'SelfCustodyVault'
    ) {
      return undefined;
    }

    const activeAction = this.contractsData.getLatestCovenantOutputAction(
      detail.actions,
    );
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
}
