import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent, KcTooltipDirective } from 'kaspacom-ui';
import { blake2b } from '@noble/hashes/blake2b';
import { WalletService } from '../../../../../services/wallet.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { RpcService } from '../../../../../services/kaspa-netwrok-services/rpc.service';
import { ContractRegistryService, ContractRegistryEntry, ContractStatus } from '../../../../../services/covenant/contract-registry.service';
import { CompiledContract, CovenantOutpoint, PartiallySignedSpend, SpendOutput } from '../../../../../services/covenant/covenant-sdk/types';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { CONTRACT_TEMPLATES, ContractTemplate, TemplateField } from '../../../../services/covenant/contract-templates';
import { CtorArg, TemplatePatcherService } from '../../../../services/covenant/template-patcher.service';

type TabName = 'deploy' | 'my-contracts' | 'interact' | 'templates';

@Component({
  selector: 'app-contracts-page',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcIconComponent,
    KcTooltipDirective,
    CopyButtonComponent,
  ],
  templateUrl: './contracts-page.component.html',
  styleUrl: './contracts-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class ContractsPageComponent implements OnInit {
  private walletService = inject(WalletService);
  private covenantService = inject(CovenantService);
  private rpcService = inject(RpcService);
  private registryService = inject(ContractRegistryService);
  private templatePatcher = inject(TemplatePatcherService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  // Current active tab
  activeTab = signal<TabName>('deploy');

  // Current wallet
  currentWallet = computed(() => this.walletService.getCurrentWallet());

  // All wallets for multi-account dropdown
  allWallets = this.walletService.getAllWallets();

  // Selected account for deploy (plain property for ngModel)
  selectedAccountId = '';

  // Computed selected account wallet
  selectedAccount = computed(() => {
    const wallets = this.allWallets();
    if (!wallets || !this.selectedAccountId) return undefined;
    return wallets.find((w) => w.getIdWithAccount() === this.selectedAccountId);
  });

  // Computed pubkey for selected account
  selectedPubkey = computed(() => {
    const wallet = this.selectedAccount();
    if (!wallet) return '';
    return wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString();
  });

  // Deploy form - plain properties for ngModel
  deployContractJson = '';
  deployAmount = '';
  deployResult = signal<{ address: string; txid: string } | null>(null);
  deployError = signal<string | null>(null);
  isDeploying = signal(false);

  // Computed parsed contract from deploy JSON
  parsedDeployContract = computed(() => {
    try {
      if (!this.deployContractJson) return null;
      return this.covenantService.parseCompiledContract(this.deployContractJson);
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

  contractTemplates = CONTRACT_TEMPLATES;
  activeTemplate = signal<ContractTemplate | null>(null);
  templateFormValues: { [paramName: string]: string } = {};
  generatedContractJson = signal<string | null>(null);
  templateError = signal<string | null>(null);

  // Interact form - plain properties for ngModel
  selectedContractId = '';
  interactContractJson = '';
  interactOutpointTxid = '';
  interactOutpointVout = '';
  interactInputAmount = '';
  interactOutputAddress = '';

  // Lookup form
  lookupContractJson = '';
  interactOutputAmount = '';
  selectedFunction = '';
  interactResult = signal<{ txid: string; functionName: string } | null>(null);
  interactError = signal<string | null>(null);
  isInteracting = signal(false);

  // Extra function args (for non-sig/pubkey params like int amountToSeller in escrow arbitrate)
  extraArgValues: { [paramName: string]: string } = {};

  // Two-phase signing (multi-sig / escrow release)
  partialSpendJson = signal<string | null>(null);
  importPartialJson = '';
  isCompletingPartial = signal(false);
  partialCompleteResult = signal<{ txid: string; functionName: string } | null>(null);
  partialCompleteError = signal<string | null>(null);

  // Computed selected contract from registry
  selectedContract = computed(() => {
    if (!this.selectedContractId) return null;
    return this.registryContracts().find((c) => c.id === this.selectedContractId);
  });

  // Computed parsed contract from interact JSON
  parsedInteractContract = computed(() => {
    try {
      const json = this.interactContractJson || this.selectedContract()?.compiledJson;
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
    return contract.abi.filter((entry) =>
      contract.ast.functions.find((f) => f.name === entry.name && f.entrypoint)
    );
  });

  /**
   * Extra (non-sig/pubkey) params for the selected function.
   * E.g., escrow arbitrate has `amountToSeller: int`.
   */
  extraArgsForFunction = computed(() => {
    const contract = this.parsedInteractContract();
    if (!contract || !this.selectedFunction) return [];
    const abiEntry = contract.abi.find(e => e.name === this.selectedFunction);
    if (!abiEntry) return [];
    return abiEntry.inputs.filter(i => i.type_name !== 'sig' && i.type_name !== 'pubkey');
  });

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
    // Initialize with current wallet if available
    const current = this.currentWallet();
    if (current) {
      this.selectedAccountId = current.getIdWithAccount();
    }

    // Load contracts from registry
    this.loadContracts();
  }

  ngOnInit() {
    // Check for pending contract import from localStorage
    // (Saved in main.ts before Angular bootstrap, survives login redirect)
    const pending = localStorage.getItem('kaspacom_pending_contract_import');
    if (pending) {
      localStorage.removeItem('kaspacom_pending_contract_import');
      this.importFromEncoded(pending);
      return;
    }

    // Also check live URL query params / fragments (in case already logged in)
    this.route.queryParams.subscribe((params) => {
      if (params['contract']) {
        this.importFromEncoded(params['contract']);
      }
    });
    this.route.fragment.subscribe((fragment) => {
      if (fragment && fragment.startsWith('contract=')) {
        this.importFromEncoded(fragment.substring('contract='.length));
      }
    });
  }

  /**
   * Import a shared contract from base64url-encoded data
   */
  private importFromEncoded(encoded: string) {
    try {
      const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(padded)));
      const parsed = JSON.parse(json);

      if (!parsed.compiledJson) {
        console.warn('[Contracts] Shared contract missing compiledJson');
        return;
      }

      // Auto-fill the interact tab
      this.interactContractJson = parsed.compiledJson;
      if (parsed.txid) this.interactOutpointTxid = parsed.txid;
      if (parsed.vout !== undefined) this.interactOutpointVout = String(parsed.vout);
      if (parsed.amount) this.interactInputAmount = parsed.amount;
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
      this.activeTab.set('interact');

      // Clean the URL
      history.replaceState(null, '', window.location.pathname);
      console.log('[Contracts] Auto-imported shared contract:', parsed.address || parsed.name);
    } catch (e) {
      console.warn('[Contracts] Failed to parse shared contract:', e);
    }
  }

  /**
   * Generate a shareable link for a contract
   */
  shareContract(contract: ContractRegistryEntry) {
    const shareData = {
      compiledJson: contract.compiledJson,
      address: contract.contractAddress,
      txid: contract.outpoint.txid,
      vout: contract.outpoint.vout,
      amount: contract.amountSompi,
      name: contract.contractName,
    };
    const json = JSON.stringify(shareData);
    const encoded = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = `${window.location.origin}/app/contracts?contract=${encoded}`;

    navigator.clipboard.writeText(url).then(
      () => alert('Share link copied to clipboard! Send it to the other wallet.'),
      () => {
        // Fallback: show the link
        prompt('Copy this share link:', url);
      }
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

  selectTemplate(template: ContractTemplate) {
    this.activeTemplate.set(template);
    // Clear all form values — prevents stale data from previous template or localStorage
    this.templateFormValues = {};
    this.generatedContractJson.set(null);
    this.templateError.set(null);

    // Clear any localStorage-cached template form values to prevent stale auto-fill
    try {
      localStorage.removeItem('kaspacom_template_form_' + template.id);
    } catch {
      // localStorage may not be available
    }
  }

  async generateContract() {
    const template = this.activeTemplate();
    if (!template) {
      this.templateError.set('Please select a template');
      return;
    }

    this.templateError.set(null);
    this.generatedContractJson.set(null);

    try {
      const newArgs = template.fields.map((field) => this.fieldToCtorArg(field, this.templateFormValues[field.paramName]));
      const compiled = await firstValueFrom(this.http.get<any>(template.assetPath));
      const descriptor = this.templatePatcher.extractPatchDescriptor(compiled, template.placeholderArgs);
      const patched = this.templatePatcher.applyPatch(compiled, descriptor, newArgs);
      this.generatedContractJson.set(JSON.stringify(patched, null, 2));
    } catch (error: any) {
      this.templateError.set(error?.message || 'Failed to generate contract from template');
    }
  }

  useGeneratedContract() {
    const generated = this.generatedContractJson();
    if (!generated) {
      this.templateError.set('Generate a contract before deploying it');
      return;
    }

    this.deployContractJson = generated;
    this.activeTab.set('deploy');
  }

  /**
   * Load contracts from registry and check on-chain status
   */
  async loadContracts() {
    const allContracts = this.registryService.getAllContracts();
    const currentNetwork = this.network();
    const filtered = allContracts.filter((c) => c.network === currentNetwork);
    this.registryContracts.set(filtered);

    // Check on-chain status for each contract
    await this.refreshContractStatuses(filtered);
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
            (u: any) => u.outpoint?.transactionId === entry.outpoint.txid && Number(u.outpoint?.index ?? -1) === entry.outpoint.vout
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
    const updated = this.registryService.getAllContracts().filter((c) => c.network === this.network());
    this.registryContracts.set(updated);
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
  getParamTypes(params: Array<{ name: string; type_ref: { base: string } }>): string {
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
        fnParams.some((fp) => fp.type === 'pubkey' && fp.name === p.name)
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

    const wallet = this.selectedAccount();
    if (!wallet) {
      this.deployError.set('Please select an account');
      return;
    }

    const contractJson = this.deployContractJson;
    const amountKas = parseFloat(this.deployAmount);

    if (!contractJson) {
      this.deployError.set('Contract JSON is required');
      return;
    }

    if (isNaN(amountKas) || amountKas <= 0) {
      this.deployError.set('Amount must be greater than 0');
      return;
    }

    try {
      this.isDeploying.set(true);
      console.log('[Deploy] Starting deployment...');

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const amountSompi = BigInt(Math.floor(amountKas * 1e8));
      console.log('[Deploy] Contract:', compiled.contract_name, 'Amount:', amountSompi.toString(), 'sompi');
      const privateKey = wallet.getPrivateKey().toString();

      const result = await this.covenantService.deploy(compiled, amountSompi, privateKey);

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
        accessRoles: this.parseAccessRoles(compiled),
      };

      this.registryService.addContract(entry);

      this.deployResult.set({
        address: result.contractAddress,
        txid: result.txid,
      });
    } catch (error: any) {
      console.error('[Deploy] Failed:', error);
      this.deployError.set(error?.message || 'Failed to deploy contract');
    } finally {
      this.isDeploying.set(false);
    }
  }

  /**
   * Select a contract from registry for interaction
   */
  selectContractFromRegistry() {
    // Look up directly from registry — don't use the computed signal
    // because selectedContractId is a plain property (ngModel), not a signal,
    // so the computed may be stale when this fires.
    const contract = this.registryContracts().find((c) => c.id === this.selectedContractId);
    if (contract) {
      this.interactContractJson = contract.compiledJson;
      this.interactOutpointTxid = contract.outpoint.txid;
      this.interactOutpointVout = contract.outpoint.vout.toString();
      this.interactInputAmount = contract.amountSompi;
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
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

    const contractJson = this.interactContractJson;
    const txid = this.interactOutpointTxid;
    const vout = parseInt(this.interactOutpointVout, 10);
    const inputAmountSompi = this.interactInputAmount;
    const functionName = this.selectedFunction;
    const outputAddress = this.interactOutputAddress;
    const outputAmountKas = parseFloat(this.interactOutputAmount);

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

      // Build outputs based on function type
      let outputs: SpendOutput[];

      if (this.functionRequiresOutput(functionName)) {
        // Withdrawal function — validate user-provided output
        if (!outputAddress) {
          this.interactError.set('Output address is required');
          return;
        }
        if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
          this.interactError.set('Output amount must be greater than 0');
          return;
        }
        outputs = [{
          address: outputAddress,
          amount: BigInt(Math.floor(outputAmountKas * 1e8)),
        }];
      } else {
        // Redeploy function (keepAlive, increment) — send full balance minus fee back to covenant
        // IMPORTANT: DMS contract enforces tx.outputs[0].value >= tx.inputs[...].value - 1000
        // Fee MUST be <= 1000 sompi (0.00001 KAS), NOT 1_000_000!
        const covenantAddress = this.covenantService.getContractAddress(compiled);
        const feeSompi = 1000n; // 0.00001 KAS — matches contract's fee constant
        const redeployAmount = inputAmount > feeSompi ? inputAmount - feeSompi : 0n;
        outputs = [{
          address: covenantAddress,
          amount: redeployAmount,
        }];
      }

      const privateKey = wallet.getPrivateKey().toString();

      // Collect extra args (int, bool params like escrow arbitrate's amountToSeller)
      const extraArgs = this.collectExtraArgs(compiled, functionName);

      // Multi-sig functions: build partial spend instead of broadcasting
      if (this.isMultiSigFunction(functionName)) {
        const partial = await this.covenantService.buildPartial(
          compiled, functionName, outpoint, inputAmount, outputs, privateKey,
        );
        const partialJson = JSON.stringify(partial, null, 2);
        this.partialSpendJson.set(partialJson);
        navigator.clipboard.writeText(partialJson).then(
          () => {},
          () => {} // Clipboard may not be available
        );
        this.interactResult.set({
          txid: '(partial — share with co-signer)',
          functionName,
        });
        return;
      }

      const result = await this.covenantService.spend(
        compiled,
        outpoint,
        inputAmount,
        functionName,
        outputs,
        privateKey,
        Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
      );

      this.interactResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Update registry based on function type
      if (this.selectedContractId) {
        if (this.functionRequiresOutput(functionName)) {
          // Withdrawal: funds left the covenant
          this.registryService.updateContract(this.selectedContractId, {
            status: 'spent',
            spendTxid: result.txid,
            lastChecked: Date.now(),
          });
        } else {
          // Redeploy (keepAlive/increment): update the outpoint to the new UTXO
          this.registryService.updateContract(this.selectedContractId, {
            lastChecked: Date.now(),
            outpoint: { txid: result.txid, vout: 0 },
            amountSompi: (inputAmount - 1000n).toString(),
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

  /**
   * Check if current account can call a function
   */
  canCallFunction(contract: ContractRegistryEntry, functionName: string): boolean {
    const currentPubkey = this.currentWallet()?.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString();
    if (!currentPubkey) return false;

    // Check if the function requires a specific pubkey that matches the current account
    const role = contract.accessRoles.find((r) => r.functionName === functionName);
    if (!role) return false;

    // If function has pubkey params, check if any constructor param matches current pubkey
    const hasPubkeyParam = role.params.some((p) => p.type === 'pubkey');
    if (!hasPubkeyParam) return true; // No pubkey requirement, anyone can call

    // Parse contract to get constructor param values (need to check the actual baked-in values)
    // For now, we'll check if deployed by current account as a simple heuristic
    return contract.deployedBy.pubkey === currentPubkey;
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

      console.log('[Lookup] Found', utxos.length, 'UTXOs, total:', totalSompi.toString(), 'sompi');
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
    this.interactContractJson = this.lookupContractJson;
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
    return `https://tn12.kaspa.stream/addresses/${address}`;
  }

  /**
   * Get explorer link for transaction
   */
  getExplorerLink(txid: string): string {
    return `https://tn12.kaspa.stream/transactions/${txid}`;
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
    return (BigInt(sompi) / BigInt(1e8)).toString();
  }

  private fieldToCtorArg(field: TemplateField, rawValue: string | number | undefined): CtorArg {
    const value = String(rawValue ?? '').trim();
    if (!value) {
      throw new Error(`${field.label} is required`);
    }

    switch (field.type) {
      case 'address':
        return this.bytesArg(this.templatePatcher.kaspaAddressToPubkeyBytes(value));
      case 'hash32':
        return this.bytesArg(this.parseHash32(value, field.label));
      case 'int_days': {
        // this.age in SilverScript = DAA score difference (virtual blue score)
        // On mainnet (1 BPS): DAA ≈ 1/sec → 86,400/day (days * 86400 is correct)
        // Max ~194 days (3-byte encoding limit: 16,777,215 / 86400 ≈ 194)
        const days = this.parseWholeNumber(value, field.label);
        if (days > 194) {
          throw new Error(`${field.label}: maximum is 194 days (template encoding limit)`);
        }
        return this.intArg(days * 86400);
      }
      case 'int_count':
        return this.intArg(this.parseWholeNumber(value, field.label));
      case 'int_timestamp':
        return this.intArg(this.parseDateToUnixMs(value, field.label));
      default:
        throw new Error(`Unsupported template field type: ${(field as { type: string }).type}`);
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
      throw new Error(`${label} must be a valid Unix timestamp in seconds (e.g. from epochconverter.com).`);
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

  /**
   * Check if the selected function requires multiple signers (two-phase signing)
   */
  isMultiSigFunction(fnName: string): boolean {
    const contract = this.parsedInteractContract();
    if (!contract) return false;
    const abiEntry = contract.abi.find(e => e.name === fnName);
    if (!abiEntry) return false;
    return abiEntry.inputs.filter(i => i.type_name === 'sig').length > 1;
  }

  /**
   * Whether the selected function requires user-visible output address/amount fields.
   * keepAlive re-deploys to the covenant itself; increment updates on-chain state.
   */
  functionRequiresOutput(fnName: string): boolean {
    return !!fnName && !this.REDEPLOY_FUNCTIONS.has(fnName);
  }

  /**
   * Select an entrypoint function — clears stale state and auto-fills
   * output fields based on the function type.
   */
  selectFunction(name: string) {
    this.selectedFunction = name;

    // Clear stale interaction state
    this.interactError.set(null);
    this.interactResult.set(null);
    this.partialSpendJson.set(null);
    this.extraArgValues = {};

    if (this.functionRequiresOutput(name)) {
      // Withdrawal function: default output to user's wallet, clear amount
      this.interactOutputAddress = this.currentWallet()?.getAddress() || '';
      this.interactOutputAmount = '';
    } else {
      // Redeploy function (keepAlive, increment): auto-fill covenant address + correct amount
      const contract = this.parsedInteractContract();
      if (contract) {
        this.interactOutputAddress = this.covenantService.getContractAddress(contract);
      }
      // Use contract's fee constant (1000 sompi), NOT fillMaxOutputAmount (which uses 1M)
      const inputSompi = this.interactInputAmount;
      if (inputSompi) {
        try {
          const outputSompi = BigInt(inputSompi) - 1000n;
          const outputKas = Number(outputSompi) / 1e8;
          this.interactOutputAmount = outputKas.toFixed(8).replace(/\.?0+$/, '');
        } catch { /* ignore */ }
      }
    }
  }

  /**
   * Get human-readable label for a function
   */
  getFunctionLabel(name: string): string {
    const labels: Record<string, string> = {
      'spend': '💰 Withdraw',
      'recover': '🔐 Recovery Withdraw',
      'claim': '📥 Claim',
      'release': '🔓 Release',
      'refund': '↩️ Refund',
      'increment': '➕ Increment',
      'keepAlive': '♻️ Keep Alive',
      'execute': '⚡ Execute',
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
      'timelockvault': {
        'spend': 'Withdraw your locked funds immediately using the owner key.',
        'recover': 'Emergency recovery using the backup key. Only available after the timelock expires.',
      },
      'deadmansswitch': {
        'keepAlive': 'Prove you\'re still active. Re-deploys the contract with a fresh expiry — no withdrawal needed.',
        'claim': 'Claim the inheritance. Only available if the owner missed their keepAlive deadline.',
      },
      'escrow': {
        'release': 'Both buyer and seller agree to release funds to the recipient.',
        'refund': 'Cancel the escrow and return funds to the sender. May require timelock expiry.',
      },
      'multisigvault': {
        'spend12': 'Withdraw using 2-of-3 multi-sig. Requires signatures from two key holders.',
      },
      'counter': {
        'increment': 'Increment the on-chain counter. The contract is re-deployed with the updated state.',
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
      'spend': 'Withdraw funds using the owner key. Available immediately — no timelock.',
      'recover': 'Emergency withdrawal using the recovery key. Only available after the timelock expires.',
      'claim': 'Claim the funds locked in this contract.',
      'release': 'Release the locked funds to the designated recipient.',
      'refund': 'Return the locked funds to the original sender.',
      'increment': 'Update the on-chain state. The contract is re-deployed with new values.',
      'keepAlive': 'Re-deploy the contract with a refreshed timer. No funds are withdrawn.',
      'execute': 'Execute this contract\'s logic.',
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
      // Reserve 0.01 KAS (1,000,000 sompi) for transaction fee
      const feeSompi = BigInt(1_000_000);
      const outputSompi = inputSompi > feeSompi ? inputSompi - feeSompi : 0n;
      const outputKas = Number(outputSompi) / 1e8;
      this.interactOutputAmount = outputKas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      // Invalid amount
    }
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
        const pubkeyBytes = this.templatePatcher.kaspaAddressToPubkeyBytes(value.trim());
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
    return Array.from(hash).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Compute blake2b-256 hash of a hex value and update the field
   */
  computeBlake2bHash(paramName: string) {
    const value = (this.templateFormValues[paramName] || '').trim().replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(value)) return;

    this.templateFormValues[paramName] = this.computeBlake2bHex(this.hex32ToBytes(value));
    this.templateFormValues[paramName + '_isAutoHashed'] = 'true';
  }

  // ─── Extra Args (int/bool params) ──────────────────────────────────

  /**
   * Collect extra args from the form into a Record<string, bigint> for the SDK.
   */
  private collectExtraArgs(compiled: CompiledContract, functionName: string): Record<string, bigint> {
    const abiEntry = compiled.abi.find(e => e.name === functionName);
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
      this.partialCompleteError.set('Paste the partial spend JSON from the co-signer');
      return;
    }

    try {
      this.isCompletingPartial.set(true);
      const partial: PartiallySignedSpend = JSON.parse(this.importPartialJson);
      const privateKey = wallet.getPrivateKey().toString();
      const result = await this.covenantService.completePartial(partial, privateKey);

      this.partialCompleteResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Update registry if we know the contract
      if (this.selectedContractId) {
        this.registryService.updateContract(this.selectedContractId, {
          status: 'spent',
          spendTxid: result.txid,
          lastChecked: Date.now(),
        });
        this.loadContracts();
      }
    } catch (error: any) {
      this.partialCompleteError.set(error?.message || 'Failed to complete partial spend');
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
}
