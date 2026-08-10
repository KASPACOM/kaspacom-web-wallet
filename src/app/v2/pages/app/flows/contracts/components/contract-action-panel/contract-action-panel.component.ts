import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import {
  DropdownOption,
  KcButtonComponent,
  KcDropdownSelectComponent,
  KcIconComponent,
  KcNumberInputComponent,
  KcTooltipDirective,
  NotificationService,
} from '@kaspacom/ui-kit';
import { WalletService } from '../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../services/wallet-action.service';
import { QrScannerService } from '../../../../../../../services/qr-scanner.service';
import { CovenantService } from '../../../../../../../services/covenant/covenant.service';
import { ContractRegistryEntry } from '../../../../../../../services/covenant/contract-registry.service';
import {
  CompiledContract,
  CovenantOutpoint,
  PartiallySignedSpend,
  SpendOutput,
} from '../../../../../../../services/covenant/covenant-sdk/types';
import type { CovenantFunctionArg } from '../../../../../../../services/covenant/covenant-sdk/covenant';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
import {
  PartialSpendJsonDialogData,
  PartialSpendJsonModalComponent,
} from '../partial-spend-json-modal/partial-spend-json-modal.component';
import { downloadJsonFile, readJsonFile } from '../../json-file.util';
import { TemplatePatcherService } from '../../../../../../services/covenant/template-patcher.service';
import { WalletActionType } from '../../../../../../../types/wallet-action';
import {
  CovenantCompletePartialActionResult,
  CovenantSpendActionResult,
} from '../../../../../../../types/wallet-action-result';
import { FlowPagesService } from '../../../../../../services/flow-pages.service';
import { ApprovalFlowService } from '../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CovenantDateTimeInputComponent } from '../../covenant-date-time-input.component';
import {
  ActionFieldConfigEntry,
  CONTRACT_ACTION_FIELDS,
} from '../../contract-action-fields.config';
import { ContractActionFieldsComponent } from '../contract-action-fields/contract-action-fields.component';
import {
  TabName,
  ContractDetailTab,
  ContractDashboardEntry,
  ContractDetailState,
  AvailableAction,
  ActionIndexerState,
} from '../../contracts-page.models';
import { ContractDisplayService } from '../../services/contract-display.service';
import { CovenantTemplateService } from '../../services/covenant-template.service';
import { ContractsDataService } from '../../services/contracts-data.service';

@Component({
  selector: 'app-contract-action-panel',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcDropdownSelectComponent,
    KcIconComponent,
    KcNumberInputComponent,
    KcTooltipDirective,
    CopyButtonComponent,
    AddressSmartInputComponent,
    CovenantDateTimeInputComponent,
    ContractActionFieldsComponent,
  ],
  templateUrl: './contract-action-panel.component.html',
  styleUrl: './contract-action-panel.component.scss',
})
export class ContractActionPanelComponent {
  private covenantService = inject(CovenantService);
  private walletActionService = inject(WalletActionService);
  private templatePatcher = inject(TemplatePatcherService);
  private templateService = inject(CovenantTemplateService);
  private contractsData = inject(ContractsDataService);
  private approvalFlowService = inject(ApprovalFlowService);
  private flowPagesService = inject(FlowPagesService);
  private notificationService = inject(NotificationService);
  private qrScannerService = inject(QrScannerService);
  private dialog = inject(Dialog);
  private walletService = inject(WalletService);
  display = inject(ContractDisplayService);

  // ─── Shell-owned data, read-only from here ─────────────────────────
  selectedDetail = input<ContractDetailState | null>(null);
  activeTab = input<TabName>('my-contracts');
  detailPanelTab = input<ContractDetailTab>('details');
  registryContracts = input<ContractRegistryEntry[]>([]);
  registryContractOptions = input<DropdownOption[]>([]);
  availableActions = input<AvailableAction[]>([]);
  actionsPanelReady = input<boolean>(false);
  editingAliasKey = input<string | null>(null);
  aliasNotice = input<{ key: string; message: string } | null>(null);

  // Command channel replacing direct shell -> this.selectFunction() calls
  // (selectDetailAction / selectDefaultFunctionForContract, still shell/Phase-7
  // methods). A fresh object identity on every request guarantees the effect
  // re-fires even if the same function name is picked twice in a row.
  pendingFunctionSelect = input<{ fn: string } | null>(null);

  // ─── Shell-owned interact state, two-way ───────────────────────────
  // Kept shell-owned (not fully adopted here) because it's also read/written
  // by not-yet-extracted Phase 7 shell methods: selectDetailAction(),
  // prepareDetailInteractState(), clearInteractContractSelection(),
  // selectDefaultFunctionForContract(), and restoreTransientState().
  selectedContractId = model<string>('');
  interactContractJson = model<string>('');
  interactResult = model<{ txid: string; functionName: string } | null>(null);
  interactError = model<string | null>(null);
  interactIndexerState = model<ActionIndexerState | null>(null);
  partialSpendJson = model<string | null>(null);
  partialCompleteResult = model<{ txid: string; functionName: string } | null>(
    null,
  );
  partialCompleteError = model<string | null>(null);
  actionPageView = model<'list' | 'form'>('list');
  selectedFunction = model<string>('');
  interactOutpointTxid = model<string>('');
  interactOutpointVout = model<string>('');
  interactInputAmount = model<string>('');
  interactOutputAddress = model<string>('');
  interactOutputAmount = model<string>('');
  topUpAmount = model<string>('');
  interactResolvedOutputAddress = model<string | null>(null);

  // ─── Local-only state (never read outside this component) ─────────
  isInteracting = signal(false);
  isCompletingPartial = signal(false);
  dmsNewExpiry = '';
  useSenderFee = true;
  extraArgValues: { [paramName: string]: string } = {};
  importPartialJson = '';
  aliasDraft = '';
  selectedCoSignerRole = '';

  // Bound to the shell's currentWalletAliasKey() — used only to recompute
  // aliasDraft the same way ContractsDashboardComponent does, so the two
  // editors agree on what the draft text should be.
  walletKey = input<string | undefined>(undefined);

  // ─── Outputs ────────────────────────────────────────────────────────
  registryEntryUpdated = output<{
    id: string;
    updates: Partial<ContractRegistryEntry>;
  }>();
  actionIndexingRequested = output<{ txid: string; registryId: string }>();
  backToListRequested = output<void>();
  aliasEditRequested = output<ContractDashboardEntry>();
  aliasEditCancelled = output<void>();
  aliasSaveRequested = output<{
    contract: ContractDashboardEntry;
    draft: string;
  }>();
  aliasRemoveRequested = output<ContractDashboardEntry>();

  private readonly contractsDebugEnabled = false;
  private readonly debugLogKeys = new Set<string>();

  private logContractsDebug(message: string, data?: Record<string, unknown>) {
    if (!this.contractsDebugEnabled) return;
    console.log(message, data);
  }

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

  constructor() {
    effect(() => {
      const request = this.pendingFunctionSelect();
      if (request) this.selectFunction(request.fn);
    });

    effect(() => {
      const key = this.editingAliasKey();
      const entry = this.selectedDetail()?.entry;
      if (!key || !entry || this.getAliasEditKey(entry) !== key) {
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

  currentWallet = computed(() => this.walletService.getCurrentWallet());

  selectedContract = computed(() => {
    if (!this.selectedContractId()) return null;
    return (
      this.registryContracts().find(
        (c) => c.id === this.selectedContractId(),
      ) || null
    );
  });

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
          currentWallet: !!this.currentWallet(),
        },
      );
      return [];
    }
    let funcs = contract.abi.filter((entry) =>
      contract.ast.functions.find((f) => f.name === entry.name && f.entrypoint),
    );

    if (contract.contract_name === 'MultiSigVault') {
      funcs = funcs.filter(
        (entry) => !['spend12', 'spend13', 'spend23'].includes(entry.name),
      );
    }

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
   * plain string signal `selectedFunction` that a computed() might otherwise
   * miss if it changed via the model's internal write path.
   */
  extraArgsForFunction(): Array<{ name: string; type_name: string }> {
    const contract = this.parsedInteractContract();
    if (!contract || !this.selectedFunction()) return [];
    if (this.isPseudoAction(this.selectedFunction())) return [];
    const abiEntry = contract.abi.find(
      (e) => e.name === this.selectedFunction(),
    );
    if (!abiEntry) return [];
    // For Escrow arbitrate, amountToSeller is collected via the standard
    // "Withdraw Amount (KAS)" field, so we don't render a separate input for it.
    if (
      this.selectedFunction() === 'arbitrate' &&
      contract.contract_name === 'Escrow'
    )
      return [];
    if (
      contract.contract_name === 'DeadManSwitch' &&
      this.selectedFunction() === 'keepAlive'
    )
      return [];
    if (
      contract.contract_name === 'SelfCustodyVault' &&
      ['emergencySweep', 'finalize'].includes(this.selectedFunction())
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
    this.topUpAmount.set(value || '');
    this.interactError.set(null);
  }

  onInteractContractSelect(value: any) {
    this.selectedContractId.set(value || '');
    this.selectContractFromRegistry();
  }

  /**
   * Select a contract from registry for interaction
   */
  selectContractFromRegistry() {
    const contract = this.registryContracts().find(
      (c) => c.id === this.selectedContractId(),
    );
    if (contract) {
      this.interactContractJson.set(contract.compiledJson);
      this.interactOutpointTxid.set(contract.outpoint.txid);
      this.interactOutpointVout.set(contract.outpoint.vout.toString());
      this.interactInputAmount.set(contract.amountSompi);
      this.interactOutputAddress.set(this.currentWallet()?.getAddress() || '');
      this.interactResolvedOutputAddress.set(null);
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
    const txid = this.interactOutpointTxid();
    const vout = parseInt(this.interactOutpointVout(), 10);
    const inputAmountSompi = this.interactInputAmount();
    const selectedAction = this.selectedFunction();
    const functionName = this.resolveSelectedFunctionName();
    let outputAddress =
      this.interactResolvedOutputAddress() || this.interactOutputAddress();
    const outputAmountKas = parseFloat(this.interactOutputAmount());
    const topUpAmountKas = parseFloat(this.topUpAmount());

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

    if (!selectedAction) {
      this.interactError.set('Please select an entrypoint function');
      return;
    }

    if (selectedAction === 'completePartial') {
      await this.completePartialSpend();
      return;
    }

    if (!functionName) {
      this.interactError.set('Please select a co-signer wallet');
      return;
    }

    try {
      this.isInteracting.set(true);

      let compiled = this.covenantService.parseCompiledContract(contractJson);
      compiled = this.hydrateSelfCustodyTn10FromIndexer(compiled);
      const actionContractJson = JSON.stringify(compiled, null, 2);
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
          useSenderFeeOverride = true;
          this.templateService.logSelfCustodyContractParams(
            'topUp continuation output',
            {
              inputAmountSompi: inputAmount,
              topUpAmountSompi: topUpAmount,
              outputs,
              covenantId,
              currentTn10: compiled.tn10,
              currentAddress: this.covenantService.getContractAddress(compiled),
            },
          );
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
        const buyerAddress = pubkeys[0]
          ? this.templateService.pubkeyToAddress(pubkeys[0])
          : '';
        const sellerAddress = pubkeys[1]
          ? this.templateService.pubkeyToAddress(pubkeys[1])
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
            actionContractJson,
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
            this.registryEntryUpdated.emit({
              id: this.selectedContractId(),
              updates: {
                status: 'spent',
                spendTxid: result.txid,
                lastChecked: Date.now(),
              },
            });
            this.actionIndexingRequested.emit({
              txid: result.txid,
              registryId: this.selectedContractId(),
            });
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
          ? this.templateService.pubkeyToAddress(pubkeys[1])
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
          actionContractJson,
          outpoint,
          inputAmount,
          outputAddress,
        );
        return;
      } else if (this.isTimeLockChangeRecovery()) {
        await this.executeTimeLockChangeRecovery(
          compiled,
          actionContractJson,
          outpoint,
          inputAmount,
          outputAddress,
        );
        return;
      } else if (this.isSelfCustodyUnvault()) {
        await this.executeSelfCustodyUnvault(
          compiled,
          actionContractJson,
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
          if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
            this.interactError.set('Output amount must be greater than 0');
            return;
          }
          const withdrawalAmount = BigInt(Math.floor(outputAmountKas * 1e8));
          const withdrawalOutputs = this.buildWithdrawalOutputs(
            compiled,
            inputAmount,
            outputAddress,
            withdrawalAmount,
          );
          if (!withdrawalOutputs) return;
          outputs = withdrawalOutputs;
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
          actionContractJson,
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
              compiledContractJson: actionContractJson,
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
          interactContractJson: actionContractJson,
          interactOutpointTxid: this.interactOutpointTxid(),
          interactOutpointVout: this.interactOutpointVout(),
          interactInputAmount: this.interactInputAmount(),
          interactOutputAddress: this.interactOutputAddress(),
          interactOutputAmount: this.interactOutputAmount(),
          topUpAmount: this.topUpAmount(),
          partialSpendJson: partialJson,
          interactResult: {
            txid: '(partial - share with co-signer)',
            functionName,
          },
        } as any);
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
        actionContractJson,
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
          this.registryEntryUpdated.emit({
            id: this.selectedContractId(),
            updates: {
              lastChecked: Date.now(),
              outpoint: { txid: result.txid, vout: 0 },
              amountSompi: outputs[0].amount.toString(),
              covenantId:
                this.selectedContract()?.covenantId || result.covenantId,
            },
          });
          this.interactOutpointTxid.set(result.txid);
          this.interactOutpointVout.set('0');
          this.interactInputAmount.set(outputs[0].amount.toString());
          this.topUpAmount.set('');
        } else if (this.functionRequiresOutput(functionName)) {
          const covenantAddress =
            this.covenantService.getContractAddress(compiled);
          const continuationOutputIndex = outputs.findIndex(
            (output) => output.address === covenantAddress,
          );
          if (continuationOutputIndex >= 0) {
            const continuationAmount = outputs[continuationOutputIndex].amount;
            this.registryEntryUpdated.emit({
              id: this.selectedContractId(),
              updates: {
                lastChecked: Date.now(),
                outpoint: { txid: result.txid, vout: continuationOutputIndex },
                amountSompi: continuationAmount.toString(),
              },
            });
            this.interactOutpointTxid.set(result.txid);
            this.interactOutpointVout.set(continuationOutputIndex.toString());
            this.interactInputAmount.set(continuationAmount.toString());
          } else {
            // Full withdrawal: funds left the covenant
            this.registryEntryUpdated.emit({
              id: this.selectedContractId(),
              updates: {
                status: 'spent',
                spendTxid: result.txid,
                lastChecked: Date.now(),
              },
            });
          }
        } else {
          // Redeploy (keepAlive/increment): update the outpoint to the new UTXO
          this.registryEntryUpdated.emit({
            id: this.selectedContractId(),
            updates: {
              lastChecked: Date.now(),
              outpoint: { txid: result.txid, vout: 0 },
              amountSompi: inputAmount.toString(), // The registry doesn't accurately know the post-fee amount until refreshed, but setting inputAmount is close enough
            },
          });
          // Update the interact form with the new outpoint
          this.interactOutpointTxid.set(result.txid);
          this.interactOutpointVout.set('0');
        }
        this.actionIndexingRequested.emit({
          txid: result.txid,
          registryId: this.selectedContractId(),
        });
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

  private readonly MIN_CONTINUATION_AMOUNT_SOMPI = 50_000_000n;

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
    this.templateService.logSelfCustodyContractParams(
      'unvault continuation target',
      {
        inputAmountSompi: inputAmount,
        covenantId,
        currentTn10: compiled.tn10,
        nextTn10: nextCompiled.tn10,
        currentAddress: this.covenantService.getContractAddress(compiled),
        nextAddress: nextContractAddress,
        nextScriptLength: nextCompiled.script?.length,
      },
    );

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
    );
    if (!result) return;

    this.interactResult.set({ txid: result.txid, functionName: 'unvault' });

    if (this.selectedContractId()) {
      this.registryEntryUpdated.emit({
        id: this.selectedContractId(),
        updates: {
          status: 'active',
          compiledJson: nextContractJson,
          contractAddress: nextContractAddress,
          accessRoles: this.parseAccessRoles(nextCompiled),
          outpoint: { txid: result.txid, vout: 0 },
          amountSompi: inputAmount.toString(),
          lastChecked: Date.now(),
        },
      });
    }

    this.interactContractJson.set(nextContractJson);
    this.interactOutpointTxid.set(result.txid);
    this.interactOutpointVout.set('0');
    this.interactInputAmount.set(inputAmount.toString());

    this.actionIndexingRequested.emit({
      txid: result.txid,
      registryId: this.selectedContractId(),
    });
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
      this.templateService.parseDateToUnixMs(
        this.dmsNewExpiry,
        'New check-in deadline',
      ),
    );
    const currentDeadline = await this.templateService.extractTemplateIntField(
      compiled,
      'dead-mans-switch',
      'initDeadline',
    );
    const owner = await this.extractDmsPubkeyHex(compiled, 'owner');
    const heir = await this.extractDmsPubkeyHex(compiled, 'heir');
    const ownerAddress = owner
      ? this.templateService.pubkeyToAddress(owner)
      : '';
    const heirAddress = heir ? this.templateService.pubkeyToAddress(heir) : '';
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
      this.registryEntryUpdated.emit({
        id: this.selectedContractId(),
        updates: {
          status: 'active',
          compiledJson: nextContractJson,
          contractAddress: nextContractAddress,
          accessRoles: this.parseAccessRoles(nextCompiled),
          outpoint: { txid: result.txid, vout: 0 },
          amountSompi: inputAmount.toString(),
          lastChecked: Date.now(),
        },
      });
    }
    this.interactContractJson.set(nextContractJson);
    this.interactOutpointTxid.set(result.txid);
    this.interactOutpointVout.set('0');
    this.interactInputAmount.set(inputAmount.toString());
    this.dmsNewExpiry = '';

    this.actionIndexingRequested.emit({
      txid: result.txid,
      registryId: this.selectedContractId(),
    });
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
    const ownerAddress = owner
      ? this.templateService.pubkeyToAddress(owner)
      : '';
    const currentDeadline = await this.templateService.extractTemplateIntField(
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
      this.registryEntryUpdated.emit({
        id: this.selectedContractId(),
        updates: {
          status: 'active',
          compiledJson: nextContractJson,
          contractAddress: nextContractAddress,
          accessRoles: this.parseAccessRoles(nextCompiled),
          outpoint: { txid: result.txid, vout: 0 },
          amountSompi: inputAmount.toString(),
          lastChecked: Date.now(),
        },
      });
    }
    this.interactContractJson.set(nextContractJson);
    this.interactOutpointTxid.set(result.txid);
    this.interactOutpointVout.set('0');
    this.interactInputAmount.set(inputAmount.toString());
    this.interactOutputAddress.set('');
    this.interactResolvedOutputAddress.set(null);

    this.actionIndexingRequested.emit({
      txid: result.txid,
      registryId: this.selectedContractId(),
    });
  }

  private async executeTimeLockChangeRecovery(
    compiled: CompiledContract,
    contractJson: string,
    outpoint: CovenantOutpoint,
    inputAmount: bigint,
    newRecoveryAddress: string,
  ): Promise<void> {
    this.interactError.set(null);

    if (!newRecoveryAddress) {
      this.interactError.set('New recovery wallet address is required');
      return;
    }

    const covenantId = this.selectedContract()?.covenantId;
    if (!covenantId) {
      this.interactError.set(
        'Cannot change recovery until this contract covenant ID is known. Refresh/import it from the indexer first.',
      );
      return;
    }

    let newRecovery: Uint8Array;
    try {
      newRecovery = Uint8Array.from(
        this.templatePatcher.kaspaAddressToPubkeyBytes(newRecoveryAddress),
      );
    } catch {
      this.interactError.set('Enter a valid new recovery wallet address');
      return;
    }

    const owner = await this.extractTimeLockPubkeyHex(compiled, 'owner');
    const ownerAddress = owner
      ? this.templateService.pubkeyToAddress(owner)
      : '';
    const timeout = await this.templateService.extractTemplateIntField(
      compiled,
      'time-lock-vault',
      'timeout',
    );
    if (!ownerAddress || timeout === undefined) {
      this.interactError.set(
        'Could not derive owner/timeout from contract script',
      );
      return;
    }

    const nextCompiled = await this.compileTimeLockContinuation({
      ownerAddress,
      recoveryAddress: newRecoveryAddress,
      timeout,
    });
    const nextContractJson = JSON.stringify(nextCompiled, null, 2);
    const nextContractAddress =
      this.covenantService.getContractAddress(nextCompiled);
    const payloadHex = this.buildTimeLockPayloadHex({
      ownerAddress,
      recoveryAddress: newRecoveryAddress,
      timeout,
    });

    const result = await this.runCovenantSpendAction(
      compiled,
      contractJson,
      outpoint,
      inputAmount,
      'changeRecovery',
      [
        {
          address: nextContractAddress,
          amount: inputAmount,
          covenantId,
        },
      ],
      { newRecovery },
      covenantId,
      true,
      payloadHex,
    );
    if (!result) return;

    this.interactResult.set({
      txid: result.txid,
      functionName: 'changeRecovery',
    });

    if (this.selectedContractId()) {
      this.registryEntryUpdated.emit({
        id: this.selectedContractId(),
        updates: {
          status: 'active',
          compiledJson: nextContractJson,
          contractAddress: nextContractAddress,
          accessRoles: this.parseAccessRoles(nextCompiled),
          outpoint: { txid: result.txid, vout: 0 },
          amountSompi: inputAmount.toString(),
          lastChecked: Date.now(),
        },
      });
    }
    this.interactContractJson.set(nextContractJson);
    this.interactOutpointTxid.set(result.txid);
    this.interactOutpointVout.set('0');
    this.interactInputAmount.set(inputAmount.toString());
    this.interactOutputAddress.set('');
    this.interactResolvedOutputAddress.set(null);

    this.actionIndexingRequested.emit({
      txid: result.txid,
      registryId: this.selectedContractId(),
    });
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

    const { compiled, descriptor } =
      await this.templateService.getTemplatePatchContext(template.id);
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

  private async compileTimeLockContinuation(values: {
    ownerAddress: string;
    recoveryAddress: string;
    timeout: bigint;
  }): Promise<CompiledContract> {
    const template = this.templateService.templateById('time-lock-vault');
    if (!template) {
      throw new Error('Time-Lock Vault template is unavailable');
    }

    const { compiled, descriptor } =
      await this.templateService.getTemplatePatchContext(template.id);
    return this.templatePatcher.applyPatch(compiled, descriptor, [
      this.templateService.bytesArg(
        this.templatePatcher.kaspaAddressToPubkeyBytes(values.ownerAddress),
      ),
      this.templateService.bytesArg(
        this.templatePatcher.kaspaAddressToPubkeyBytes(values.recoveryAddress),
      ),
      this.templateService.intArg(Number(values.timeout)),
    ]) as CompiledContract;
  }

  private hydrateSelfCustodyTn10FromIndexer(
    compiled: CompiledContract,
  ): CompiledContract {
    if (compiled.contract_name !== 'SelfCustodyVault') {
      return compiled;
    }

    const existingArgs = this.contractsData.normalizeIndexerArgs(
      compiled.tn10?.args,
    );
    const existingValues = this.templateService.argsArrayToRecord(existingArgs);
    if (existingValues['unvaultDelaySeconds']) {
      return compiled;
    }

    const indexerArgs = this.getSelectedSelfCustodyIndexerArgs();
    const indexerValues = this.templateService.argsArrayToRecord(indexerArgs);
    if (!indexerValues['unvaultDelaySeconds']) {
      return compiled;
    }

    const tn10Args =
      indexerValues['hotKey'] && indexerValues['coldKey']
        ? this.templateService.buildSelfCustodyArgsPayload({
            hotKey: indexerValues['hotKey'],
            coldKey: indexerValues['coldKey'],
            whitelistMode: indexerValues['whitelistMode'] || '',
            whitelistedDestinations:
              indexerValues['whitelistedDestinations'] || '',
            whitelistedDestinations_mode:
              indexerValues['whitelistMode'] === 'whitelist'
                ? 'whitelist'
                : indexerValues['whitelistedDestinations']
                  ? 'whitelist'
                  : 'anywhere',
            unvaultDelaySeconds: indexerValues['unvaultDelaySeconds'],
            initPhase: indexerValues['initPhase'] || '0',
          })
        : indexerArgs;

    return {
      ...compiled,
      tn10: {
        v: compiled.tn10?.v || 1,
        tmpl: compiled.tn10?.tmpl || 'SelfCustodyVault',
        args: tn10Args,
      },
    } as CompiledContract;
  }

  private getSelectedSelfCustodyIndexerArgs(): Array<{
    name: string;
    type: string;
    value: string;
  }> {
    const detail = this.selectedDetail();
    return this.contractsData.normalizeIndexerArgs(
      detail?.response?.covenant?.claimedArgs?.args ||
        detail?.entry.indexerSummary?.claimedArgs?.args ||
        [],
    );
  }

  private async compileSelfCustodyContinuation(
    currentCompiled: CompiledContract,
    phase: number,
  ): Promise<CompiledContract> {
    const patched = this.patchSelfCustodyPhase(currentCompiled, phase);
    this.templateService.logSelfCustodyContractParams('compiled continuation', {
      phase,
      currentTn10: currentCompiled.tn10,
      nextTn10: patched.tn10,
      currentAddress: this.covenantService.getContractAddress(currentCompiled),
      nextAddress: this.covenantService.getContractAddress(patched),
      currentScriptLength: currentCompiled.script?.length,
      scriptLength: patched.script?.length,
    });

    return patched;
  }

  private patchSelfCustodyPhase(
    currentCompiled: CompiledContract,
    phase: number,
  ): CompiledContract {
    const stateLayout = (currentCompiled as any).state_layout;
    const stateStart = stateLayout?.start;
    const stateLength = stateLayout?.len;
    if (
      !Number.isInteger(stateStart) ||
      !Number.isInteger(stateLength) ||
      stateLength < 9
    ) {
      throw new Error('Self-Custody Vault state layout is missing phase bytes');
    }

    const script = [...currentCompiled.script];
    if (script[stateStart] !== 8) {
      throw new Error('Unsupported Self-Custody Vault phase state encoding');
    }

    const phaseBytes = this.templatePatcher.encodeFixedInt(phase, 8);
    script.splice(stateStart + 1, 8, ...phaseBytes);

    const patched = {
      ...currentCompiled,
      script,
      tn10: currentCompiled.tn10
        ? JSON.parse(JSON.stringify(currentCompiled.tn10))
        : undefined,
    } as CompiledContract;

    if (patched.tn10) {
      if (Array.isArray(patched.tn10.args)) {
        const phaseArg = patched.tn10.args.find(
          (arg: any) => arg?.name === 'initPhase',
        );
        if (phaseArg) {
          phaseArg.value = String(phase);
        } else {
          patched.tn10.args.push({
            name: 'initPhase',
            type: 'int',
            value: String(phase),
          });
        }
      } else if (patched.tn10.args && typeof patched.tn10.args === 'object') {
        patched.tn10.args.p = String(phase);
      }
    }

    return patched;
  }

  private async extractDmsPubkeyHex(
    compiled: CompiledContract,
    field: 'owner' | 'heir',
  ): Promise<string | undefined> {
    if (field === 'owner') {
      return this.templateService.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'owner',
      );
    }

    return (
      (await this.templateService.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'initHeir',
      )) ||
      (await this.templateService.extractTemplatePubkeyHex(
        compiled,
        'dead-mans-switch',
        'heir',
      ))
    );
  }

  private async extractTimeLockPubkeyHex(
    compiled: CompiledContract,
    field: 'owner' | 'recovery',
  ): Promise<string | undefined> {
    if (field === 'owner') {
      return this.templateService.extractTemplatePubkeyHex(
        compiled,
        'time-lock-vault',
        'owner',
      );
    }

    return (
      (await this.templateService.extractTemplatePubkeyHex(
        compiled,
        'time-lock-vault',
        'initRecovery',
      )) ||
      (await this.templateService.extractTemplatePubkeyHex(
        compiled,
        'time-lock-vault',
        'recovery',
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

  private buildTimeLockPayloadHex(values: {
    ownerAddress: string;
    recoveryAddress: string;
    timeout: bigint;
  }): string {
    return this.stringToHex(
      JSON.stringify({
        tn10: {
          v: 1,
          tmpl: 'TimeLockVault',
          args: [
            { name: 'signer', type: 'address', value: values.ownerAddress },
            {
              name: 'recoveryKey',
              type: 'address',
              value: values.recoveryAddress,
            },
            {
              name: 'unlockBlueScore',
              type: 'blueScore',
              value: values.timeout.toString(),
            },
          ],
        },
      }),
    );
  }

  private stringToHex(value: string): string {
    return Array.from(new TextEncoder().encode(value))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
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
      this.templateService.logSelfCustodyContractParams(
        'spend action parameters',
        {
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
        },
      );
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

  private parseAccessRoles(contract: CompiledContract): Array<{
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
   * Get explorer link for a transaction
   */
  getExplorerLink(txid: string): string {
    return this.display.getExplorerLink(txid);
  }

  truncate(str: string | null | undefined, length: number = 16): string {
    return this.display.truncate(str, length);
  }

  /**
   * Field-layout config for a curated action's full-page form, keyed the same way as actionMetaTable.
   */
  getActionFieldConfig(
    contractName: string,
    fnName: string,
  ): ActionFieldConfigEntry | null {
    const normalized = this.display.normalizeContractName(contractName);
    return CONTRACT_ACTION_FIELDS[normalized]?.[fnName] ?? null;
  }

  /** The curated label/description for the currently selected action, for the full-page form's header. */
  getSelectedActionMeta(): AvailableAction | undefined {
    return this.availableActions().find(
      (action) => action.fnName === this.selectedFunction(),
    );
  }

  /**
   * Field config for whatever function is currently selected. Null for
   * generic/unrecognized contracts with no curated actionMetaTable entry — those
   * keep rendering the old manual/ABI-driven chain instead of this form.
   */
  getSelectedActionFieldConfig(): ActionFieldConfigEntry | null {
    const contract = this.parsedInteractContract();
    if (!contract || !this.selectedFunction()) return null;
    return this.getActionFieldConfig(
      contract.contract_name,
      this.selectedFunction(),
    );
  }

  goBackToActionList() {
    this.actionPageView.set('list');
    this.selectedFunction.set('');
    this.interactError.set(null);
    this.interactResult.set(null);
    this.partialSpendJson.set(null);
    this.partialCompleteError.set(null);
    this.partialCompleteResult.set(null);
    this.importPartialJson = '';
    this.extraArgValues = {};
    this.selectedCoSignerRole = '';
    this.dmsNewExpiry = '';
    this.topUpAmount.set('');
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
      initiateWithdrawal: 'Initiate Withdrawal',
      completePartial: 'Sign & Broadcast',
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
      changeRecovery: 'Change Recovery',
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
        changeRecovery:
          'Change the backup wallet that can recover after the timelock expires.',
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
        initiateWithdrawal:
          'Choose which co-signer wallet should complete the withdrawal.',
        completePartial:
          'Paste a partial withdrawal JSON from another signer, add your signature, and broadcast.',
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
      completePartial:
        'Paste a partial transaction JSON, add your signature, and broadcast.',
      refund: 'Return the locked funds to the original sender.',
      increment:
        'Update the on-chain state. The contract is re-deployed with new values.',
      keepAlive:
        'Re-deploy the contract with a refreshed timer. No funds are withdrawn.',
      execute: "Execute this contract's logic.",
      topUp:
        'Add KAS to this covenant by spending the current covenant UTXO and recreating it with the same covenant ID.',
      changeRecovery: 'Re-deploy the contract with an updated recovery wallet.',
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
    const sompi = this.interactInputAmount();
    if (!sompi) return;
    try {
      const inputSompi = BigInt(sompi);
      const outputKas = Number(inputSompi) / 1e8;
      this.interactOutputAmount.set(outputKas.toFixed(8).replace(/\.?0+$/, ''));
    } catch {
      // Invalid amount
    }
  }

  onInteractOutputAddressChange(value: string) {
    this.interactOutputAddress.set(value || '');
    this.interactResolvedOutputAddress.set(null);
    this.interactError.set(null);
  }

  onInteractOutputAddressResolved(result: any) {
    if (result?.effectiveAddress) {
      this.interactResolvedOutputAddress.set(result.effectiveAddress);
    } else {
      this.interactResolvedOutputAddress.set(null);
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
    this.interactOutputAmount.set(
      value === null || value === undefined ? '' : String(value),
    );
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
    if (this.isTopUpFunction(this.selectedFunction())) {
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
          this.registryEntryUpdated.emit({
            id: this.selectedContractId(),
            updates: {
              lastChecked: Date.now(),
              outpoint: { txid: result.txid, vout: continuationOutputIndex },
              amountSompi: partial.outputs[continuationOutputIndex].amountSompi,
            },
          });
        } else {
          this.registryEntryUpdated.emit({
            id: this.selectedContractId(),
            updates: {
              status: 'spent',
              spendTxid: result.txid,
              lastChecked: Date.now(),
            },
          });
        }
        this.actionIndexingRequested.emit({
          txid: result.txid,
          registryId: this.selectedContractId(),
        });
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
      .closed.subscribe(() => this.backToListRequested.emit());
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
    if (!contract || this.selectedFunction() !== 'keepAlive') return false;
    return (contract.contract_name || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .includes('deadman');
  }

  isDmsChangeHeir(): boolean {
    const contract = this.parsedInteractContract();
    if (!contract || this.selectedFunction() !== 'changeHeir') return false;
    return (contract.contract_name || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .includes('deadman');
  }

  isTimeLockChangeRecovery(): boolean {
    const contract = this.parsedInteractContract();
    if (!contract || this.selectedFunction() !== 'changeRecovery') return false;
    return contract.contract_name === 'TimeLockVault';
  }

  isSelfCustodyUnvault(): boolean {
    const contract = this.parsedInteractContract();
    return (
      this.selectedFunction() === 'unvault' &&
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
    if (!contract || this.selectedFunction() !== 'claim') return false;
    return (contract.contract_name || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .includes('deadman');
  }

  /**
   * Check if the selected function requires multiple signers (two-phase signing)
   */
  isMultiSigFunction(fnName: string): boolean {
    if (fnName === 'initiateWithdrawal') return true;
    const contract = this.parsedInteractContract();
    if (!contract) return false;
    const abiEntry = contract.abi.find((e) => e.name === fnName);
    if (!abiEntry) return false;
    return abiEntry.inputs.filter((i) => i.type_name === 'sig').length > 1;
  }

  isPseudoAction(fnName: string): boolean {
    return fnName === 'initiateWithdrawal' || fnName === 'completePartial';
  }

  isCompletePartialAction(
    fnName: string | undefined = this.selectedFunction(),
  ): boolean {
    return fnName === 'completePartial';
  }

  isInitiateWithdrawalAction(
    fnName: string | undefined = this.selectedFunction(),
  ): boolean {
    return fnName === 'initiateWithdrawal';
  }

  private getCurrentSignerRole(): 'Signer 1' | 'Signer 2' | 'Signer 3' | '' {
    const detail = this.selectedDetail();
    const wallet = this.currentWallet();
    if (!detail || !wallet) return '';

    const walletValues = new Set<string>(
      [
        wallet.getAddress(),
        wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString(),
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    );

    const signer = (detail.entry.participants || []).find((participant) => {
      if (!['Signer 1', 'Signer 2', 'Signer 3'].includes(participant.label)) {
        return false;
      }
      const values = [participant.value, ...(participant.matchValues || [])]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return values.some((value) => walletValues.has(value));
    });

    return (signer?.label as 'Signer 1' | 'Signer 2' | 'Signer 3') || '';
  }

  private getParticipantValueForRole(role: string): string {
    const participant = (this.selectedDetail()?.entry.participants || []).find(
      (entry) => entry.label === role,
    );
    return participant?.value || role;
  }

  coSignerOptions(): DropdownOption[] {
    const currentSigner = this.getCurrentSignerRole();
    return ['Signer 1', 'Signer 2', 'Signer 3']
      .filter((role) => role !== currentSigner)
      .map((role) => ({
        value: role,
        label: `${this.getParticipantValueForRole(role)} (${role})`,
      }));
  }

  onCoSignerChange(value: unknown) {
    this.selectedCoSignerRole = value ? String(value) : '';
    this.interactError.set(null);
  }

  private resolveSelectedFunctionName(): string {
    const selected = this.selectedFunction();
    if (selected !== 'initiateWithdrawal') return selected;

    const currentSigner = this.getCurrentSignerRole();
    const coSigner = this.selectedCoSignerRole;
    const pair = [currentSigner, coSigner].sort().join('|');
    const map: Record<string, string> = {
      'Signer 1|Signer 2': 'spend12',
      'Signer 1|Signer 3': 'spend13',
      'Signer 2|Signer 3': 'spend23',
    };
    return map[pair] || '';
  }

  /**
   * Whether the selected function requires user-visible output address/amount fields.
   * keepAlive re-deploys to the covenant itself; increment updates on-chain state.
   */
  functionRequiresOutput(fnName: string): boolean {
    return (
      !!fnName &&
      fnName !== 'completePartial' &&
      !this.REDEPLOY_FUNCTIONS.has(fnName) &&
      !this.isTopUpFunction(fnName) &&
      !this.isDmsChangeHeir() &&
      !this.isTimeLockChangeRecovery()
    );
  }

  isSelfCustodySweepAction(
    fnName: string | undefined = this.selectedFunction(),
  ): boolean {
    return (
      !!fnName &&
      ['emergencySweep', 'finalize'].includes(fnName) &&
      this.parsedInteractContract()?.contract_name === 'SelfCustodyVault'
    );
  }

  isSenderFeeToggleDisabled(
    fnName: string | undefined = this.selectedFunction(),
  ): boolean {
    return (
      this.isInteracting() ||
      this.isMultiSigFunction(fnName || '') ||
      this.isSelfCustodySweepAction(fnName)
    );
  }

  getSenderFeeTooltip(
    fnName: string | undefined = this.selectedFunction(),
  ): string {
    if (this.isMultiSigFunction(fnName || '')) {
      return 'Disabled for multi-sig signing. The contract must pay fees because wallet fee inputs would change the transaction after signatures are created.';
    }
    if (this.isSelfCustodySweepAction(fnName)) {
      return 'Required for Self-Custody sweep/finalize. The covenant requires exact withdrawal and continuation outputs, so fees must be paid by the wallet.';
    }
    if (this.isTopUpFunction(fnName || '')) {
      return 'When enabled, fees are paid from wallet change. When disabled, fees are deducted from the top-up output.';
    }
    return 'If enabled, transaction fees will be paid from your wallet balance instead of the contract funds.';
  }

  getSelfCustodyInteractWhitelistWallets(): string[] {
    const contract = this.parsedInteractContract();
    if (contract?.contract_name !== 'SelfCustodyVault') return [];

    const args = this.templateService.argsArrayToRecord(
      this.contractsData.normalizeIndexerArgs(contract.tn10?.args),
    );
    const sourceArgs =
      args['unvaultDelaySeconds'] || args['whitelistedDestinations']
        ? args
        : this.templateService.argsArrayToRecord(
            this.getSelectedSelfCustodyIndexerArgs(),
          );
    const mode = String(sourceArgs['whitelistMode'] || '').toLowerCase();
    const raw = sourceArgs['whitelistedDestinations'];
    if (mode && mode !== 'whitelist') return [];
    if (!raw) return [];

    return this.templateService.getAddressListFromRaw(raw);
  }

  onSelfCustodySweepDestinationChange(address: string) {
    this.interactOutputAddress.set(address || '');
    this.interactResolvedOutputAddress.set(null);
    this.extraArgValues['destinationIndex'] = String(
      Math.max(
        0,
        this.getSelfCustodyInteractWhitelistWallets().indexOf(address),
      ),
    );
    this.interactError.set(null);
  }

  /**
   * Select an entrypoint function — clears stale state and auto-fills
   * output fields based on the function type.
   */
  selectFunction(name: string) {
    this.selectedFunction.set(name);
    this.useSenderFee =
      this.isSelfCustodySweepAction(name) || !this.isMultiSigFunction(name);

    // Clear stale interaction state
    this.interactError.set(null);
    this.interactResult.set(null);
    this.interactIndexerState.set(null);
    this.partialSpendJson.set(null);
    this.partialCompleteError.set(null);
    this.partialCompleteResult.set(null);
    this.importPartialJson = '';
    this.extraArgValues = {};
    this.selectedCoSignerRole = '';
    this.dmsNewExpiry = '';
    this.topUpAmount.set('');
    if (this.isInitiateWithdrawalAction(name)) {
      this.selectedCoSignerRole = String(
        this.coSignerOptions()[0]?.value || '',
      );
    }
    if (
      ['emergencySweep', 'finalize'].includes(name) &&
      this.parsedInteractContract()?.contract_name === 'SelfCustodyVault'
    ) {
      const whitelist = this.getSelfCustodyInteractWhitelistWallets();
      this.extraArgValues['destinationIndex'] = '0';
      if (whitelist.length > 0) {
        this.interactOutputAddress.set(whitelist[0]);
        this.interactResolvedOutputAddress.set(null);
      }
    }

    if (
      this.isTopUpFunction(name) ||
      this.isDmsChangeHeir() ||
      this.isTimeLockChangeRecovery()
    ) {
      this.interactOutputAddress.set('');
      this.interactOutputAmount.set('');
    } else if (this.functionRequiresOutput(name)) {
      // Withdrawal function: default output to user's wallet, clear amount
      this.interactOutputAddress.set(this.currentWallet()?.getAddress() || '');
      if (this.isSelfCustodySweepAction(name)) {
        const whitelist = this.getSelfCustodyInteractWhitelistWallets();
        if (whitelist.length > 0) {
          this.interactOutputAddress.set(whitelist[0]);
          this.interactResolvedOutputAddress.set(null);
          this.extraArgValues['destinationIndex'] = '0';
        }
        const inputSompi = this.interactInputAmount();
        if (inputSompi) {
          try {
            this.interactOutputAmount.set(
              (Number(BigInt(inputSompi)) / 1e8)
                .toFixed(8)
                .replace(/\.?0+$/, ''),
            );
          } catch {
            this.interactOutputAmount.set('');
          }
        } else {
          this.interactOutputAmount.set('');
        }
      } else {
        this.interactOutputAmount.set('');
      }
    } else if (this.isSelfCustodyUnvault()) {
      this.interactOutputAddress.set('');
      this.interactOutputAmount.set('');
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
      this.interactOutputAddress.set('');
      this.interactOutputAmount.set('');
    } else {
      // Redeploy function (keepAlive on other contracts, increment): auto-fill covenant address + correct amount
      const contract = this.parsedInteractContract();
      if (contract) {
        this.interactOutputAddress.set(
          this.covenantService.getContractAddress(contract),
        );
      }
      const inputSompi = this.interactInputAmount();
      if (inputSompi) {
        try {
          const outputSompi = BigInt(inputSompi);
          const outputKas = Number(outputSompi) / 1e8;
          this.interactOutputAmount.set(
            outputKas.toFixed(8).replace(/\.?0+$/, ''),
          );
        } catch {
          this.interactOutputAmount.set('');
        }
      }
    }
  }

  interactInputAmountKas = computed(() => {
    const sompi = this.interactInputAmount();
    if (!sompi) return '0';
    try {
      const kas = Number(BigInt(sompi)) / 1e8;
      return kas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  });

  // ─── Alias editing (shell-owned; relayed so the same contract's editor
  // stays in sync whether opened from a dashboard card, the detail panel,
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
}
