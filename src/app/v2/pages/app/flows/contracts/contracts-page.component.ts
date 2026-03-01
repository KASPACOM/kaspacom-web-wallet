import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { RpcService } from '../../../../../services/kaspa-netwrok-services/rpc.service';
import { ContractRegistryService, ContractRegistryEntry } from '../../../../../services/covenant/contract-registry.service';
import { CompiledContract, CovenantOutpoint, SpendOutput } from '../../../../../services/covenant/covenant-sdk/types';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';

type TabName = 'deploy' | 'my-contracts' | 'interact';

@Component({
  selector: 'app-contracts-page',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcIconComponent,
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

  /**
   * Load contracts from registry
   */
  loadContracts() {
    const allContracts = this.registryService.getAllContracts();
    const currentNetwork = this.network();
    const filtered = allContracts.filter((c) => c.network === currentNetwork);
    this.registryContracts.set(filtered);
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

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const amountSompi = BigInt(Math.floor(amountKas * 1e8));
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
}
