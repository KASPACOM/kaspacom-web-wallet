import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../services/wallet.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { CompiledContract, CovenantOutpoint, SpendOutput } from '../../../../../services/covenant/covenant-sdk/types';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';

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

  // Current wallet
  currentWallet = computed(() => this.walletService.getCurrentWallet());

  // Deploy form
  deployContractJson = signal('');
  deployAmount = signal('');
  deployResult = signal<{ address: string; txid: string } | null>(null);
  deployError = signal<string | null>(null);
  isDeploying = signal(false);

  // Interact form
  interactContractJson = signal('');
  interactOutpoint = signal('');
  interactInputAmount = signal('');
  interactOutputAddress = signal('');
  interactOutputAmount = signal('');
  selectedFunction = signal('');
  interactResult = signal<{ txid: string; functionName: string } | null>(null);
  interactError = signal<string | null>(null);
  isInteracting = signal(false);

  // Computed available functions from the contract JSON
  availableFunctions = computed(() => {
    const json = this.interactContractJson();
    if (!json) return [];

    try {
      const contract: CompiledContract = JSON.parse(json);
      return contract.abi.filter(entry => 
        contract.ast.functions.find(f => f.name === entry.name && f.entrypoint)
      );
    } catch {
      return [];
    }
  });

  /**
   * Deploy a contract
   */
  async deployContract() {
    this.deployError.set(null);
    this.deployResult.set(null);

    const wallet = this.currentWallet();
    if (!wallet) {
      this.deployError.set('No wallet connected');
      return;
    }

    const contractJson = this.deployContractJson();
    const amountKas = parseFloat(this.deployAmount());

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
   * Interact with a deployed contract
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
    const outpointStr = this.interactOutpoint();
    const inputAmountSompi = this.interactInputAmount();
    const functionName = this.selectedFunction();
    const outputAddress = this.interactOutputAddress();
    const outputAmountKas = parseFloat(this.interactOutputAmount());

    if (!contractJson) {
      this.interactError.set('Contract JSON is required');
      return;
    }

    if (!outpointStr || !outpointStr.includes(':')) {
      this.interactError.set('Outpoint must be in format txid:vout');
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
      const [txid, voutStr] = outpointStr.split(':');
      const outpoint: CovenantOutpoint = {
        txid: txid.trim(),
        vout: parseInt(voutStr.trim(), 10),
      };

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
        privateKey,
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
   * Load example contract JSON (for testing)
   */
  loadExampleContract() {
    const example: CompiledContract = {
      contract_name: 'ExampleContract',
      script: [],
      ast: {
        name: 'ExampleContract',
        params: [],
        constants: {},
        functions: [
          {
            name: 'release',
            params: [],
            entrypoint: true,
            return_types: [],
            body: [],
          },
        ],
      },
      abi: [
        {
          name: 'release',
          inputs: [],
        },
      ],
      without_selector: false,
    };
    this.deployContractJson.set(JSON.stringify(example, null, 2));
  }
}
