import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent, KcTooltipDirective } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { RpcService } from '../../../../../services/kaspa-netwrok-services/rpc.service';
import { ContractRegistryService, ContractRegistryEntry, ContractStatus } from '../../../../../services/covenant/contract-registry.service';
import { CompiledContract, CovenantOutpoint, SpendOutput } from '../../../../../services/covenant/covenant-sdk/types';
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
export class ContractsPageComponent {
  private walletService = inject(WalletService);
  private covenantService = inject(CovenantService);
  private rpcService = inject(RpcService);
  private registryService = inject(ContractRegistryService);
  private templatePatcher = inject(TemplatePatcherService);
  private http = inject(HttpClient);

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
  interactOutputAmount = '';
  selectedFunction = '';
  interactResult = signal<{ txid: string; functionName: string } | null>(null);
  interactError = signal<string | null>(null);
  isInteracting = signal(false);

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
    this.templateFormValues = {};
    this.generatedContractJson.set(null);
    this.templateError.set(null);
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
        outpoint: {
          txid: result.txid,
          vout: 0, // Deployment output is usually vout 0
        },
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
    const contract = this.selectedContract();
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

    if (!outputAddress) {
      this.interactError.set('Output address is required');
      return;
    }

    if (isNaN(outputAmountKas) || outputAmountKas <= 0) {
      this.interactError.set('Output amount must be greater than 0');
      return;
    }

    try {
      this.isInteracting.set(true);

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const outpoint: CovenantOutpoint = { txid: txid.trim(), vout };

      const outputs: SpendOutput[] = [
        {
          address: outputAddress,
          amount: BigInt(Math.floor(outputAmountKas * 1e8)),
        },
      ];

      const privateKey = wallet.getPrivateKey().toString();
      const inputAmount = BigInt(inputAmountSompi);

      const result = await this.covenantService.spend(
        compiled,
        outpoint,
        inputAmount,
        functionName,
        outputs,
        privateKey
      );

      this.interactResult.set({
        txid: result.txid,
        functionName: result.functionName,
      });

      // Mark contract as spent in registry
      if (this.selectedContractId) {
        this.registryService.updateContract(this.selectedContractId, {
          status: 'spent',
          spendTxid: result.txid,
          lastChecked: Date.now(),
        });
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

    // Switch to interact tab with the first UTXO pre-filled
    this.interactOutpointTxid = result.utxos[0].txid;
    this.interactOutpointVout = String(result.utxos[0].vout);
    this.interactInputAmount = result.utxos[0].amount;
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
      case 'int_days':
        return this.intArg(this.parseWholeNumber(value, field.label) * 86400);
      case 'int_count':
        return this.intArg(this.parseWholeNumber(value, field.label));
      case 'int_timestamp':
        return this.intArg(this.parseDateToUnixSeconds(value, field.label));
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

  private parseDateToUnixSeconds(value: string, label: string): number {
    // Accept raw Unix timestamp in seconds
    // NOTE: Kaspa's LOCK_TIME_THRESHOLD = 500,000,000,000.
    // Values < 500B are treated as DAA scores by consensus, NOT as time.
    // Unix seconds (~1.7B) fall below this threshold.
    // For proper time-based locking, SilverScript contracts should use
    // millisecond timestamps (>= 500B) and be compiled with appropriate
    // placeholder sizes. Current templates use seconds for simplicity.
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0 && Number.isInteger(asNumber)) {
      if (asNumber > 946684800) {
        return asNumber;
      }
    }

    // Fallback: try parsing as date string
    const timestampMs = new Date(value).getTime();
    if (!Number.isFinite(timestampMs)) {
      throw new Error(`${label} must be a valid Unix timestamp in seconds. Use epochconverter.com to convert a date.`);
    }

    return Math.floor(timestampMs / 1000);
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

  /**
   * Select an entrypoint function
   */
  selectFunction(name: string) {
    this.selectedFunction = name;
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
   * Get human-readable description for a function
   */
  getFunctionDescription(name: string): string {
    const contract = this.parsedInteractContract();
    const contractName = contract?.contract_name || '';

    const descriptions: Record<string, string> = {
      'spend': 'Withdraw funds using the owner key. Available immediately — no timelock.',
      'recover': 'Emergency withdrawal using the recovery key. Only available after the timelock expires.',
      'claim': 'Claim the funds locked in this contract to your address.',
      'release': 'Release the locked funds to the designated recipient.',
      'refund': 'Return the locked funds to the original sender.',
      'increment': 'Increment the on-chain counter state by 1.',
      'keepAlive': 'Reset the dead man\'s switch timer. Must be called before timeout to prevent recovery.',
      'execute': 'Execute this contract\'s logic.',
    };

    return descriptions[name] || `Call the "${name}" function on this contract.`;
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
}
