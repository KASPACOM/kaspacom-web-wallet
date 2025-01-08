import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';
import { KaspaNetworkTransactionsManagerService } from '../../services/kaspa-netwrok-services/kaspa-network-transactions-manager.service';
import { KaspaNetworkActionsService, MINIMAL_AMOUNT_TO_SEND } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SavedWalletData } from '../../types/saved-wallet-data';
import { RpcService } from '../../services/kaspa-netwrok-services/rpc.service';
import { KaspaNetworkConnectionManagerService } from '../../services/kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { UtilsHelper } from '../../services/utils.service';
import { Krc20OperationDataService } from '../../services/kaspa-netwrok-services/krc20-operation-data.service';
import { Mnemonic, XPrv } from '../../../../public/kaspa/kaspa';

@Component({
  standalone: true,
  imports: [CommonModule],
  providers: [
    KaspaNetworkActionsService,
    KaspaNetworkTransactionsManagerService,
    RpcService,
    KaspaNetworkConnectionManagerService,
    UtilsHelper,
    Krc20OperationDataService
  ],
  selector: 'app-test-inscriptions',
  template: `
    <div class="p-4">
      <h2 class="text-xl mb-4">Inscription Tests</h2>
      
      <!-- Wallet Info -->
      <div class="mb-6 p-4 bg-gray-100 rounded">
        <h3 class="font-bold mb-2">Test Wallet Info</h3>
        <p class="mb-1">Address: {{testWallet?.getAddress()}}</p>
        <p class="mb-1">Mnemonic: {{walletMnemonic}}</p>
        <p>Private Key: {{walletPrivateKey}}</p>
      </div>

      <!-- Text Inscription -->
      <div class="mb-4">
        <button (click)="testTextInscription()" 
                class="bg-blue-500 text-white px-4 py-2 rounded">
          Test Text Inscription
        </button>
        <pre class="mt-2">{{convertBigIntsToStrings(textResult) | json}}</pre>
      </div>

      <!-- Domain Inscription -->
      <div class="mb-4">
        <button (click)="testDomainInscription()" 
                class="bg-green-500 text-white px-4 py-2 rounded">
          Test Domain Inscription
        </button>
        <pre class="mt-2">{{convertBigIntsToStrings(domainResult) | json}}</pre>
      </div>

      <!-- Binary Inscription -->
      <div class="mb-4">
        <button (click)="testBinaryInscription()" 
                class="bg-purple-500 text-white px-4 py-2 rounded">
          Test Binary Inscription
        </button>
        <pre class="mt-2">{{convertBigIntsToStrings(binaryResult) | json}}</pre>
      </div>
    </div>
  `
})
export class TestInscriptionsComponent implements OnInit {
  textResult: any = null;
  domainResult: any = null;
  binaryResult: any = null;
  testWallet: AppWallet | null = null;
  walletMnemonic: string = '';
  walletPrivateKey: string = '';

  convertBigIntsToStrings(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntsToStrings(item));
    }
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          newObj[key] = this.convertBigIntsToStrings(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }

  constructor(
    private transactionManager: KaspaNetworkTransactionsManagerService,
    private networkActions: KaspaNetworkActionsService
  ) {}

  async ngOnInit() {
    try {
      // Initialize wallet first
      this.initializeTestWallet();
      if (!this.testWallet) {
        throw new Error('Failed to initialize wallet');
      }

      // Initialize UTXO processor
      const utxoProcessor = await this.initializeUtxoProcessor();
      if (!utxoProcessor) {
        throw new Error('Failed to initialize UTXO processor');
      }

      // Store UTXO processor in wallet
      await this.testWallet.refreshBalance();
      
      console.log('Wallet and UTXO processor initialized successfully');
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  }

  private async initializeUtxoProcessor() {
    if (!this.testWallet) {
      throw new Error('Wallet not initialized');
    }

    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
      try {
        // Initialize UTXO processor in transaction manager
        const utxoProcessor = await this.transactionManager.initUtxoProcessorManager(
          this.testWallet.getAddress(),
          async () => {
            console.log('Balance updated');
            const balance = await this.transactionManager.getWalletTotalBalanceAndUtxos(this.testWallet!.getAddress());
            console.log('Current balance:', balance);
          }
        );

        // Wait for UTXO processor initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify UTXO processor is working
        const balance = await this.transactionManager.getWalletTotalBalanceAndUtxos(this.testWallet.getAddress());
        console.log('Initial balance:', balance);
        
        // Verify UTXO context is ready
        const context = utxoProcessor.getContext();
        if (!context) {
          throw new Error('UTXO context not initialized');
        }

        console.log('UTXO processor initialized successfully');
        return utxoProcessor;
      } catch (error) {
        lastError = error as Error;
        console.error(`UTXO processor initialization failed (${retries} retries remaining):`, error);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError || new Error('Failed to initialize UTXO processor after multiple attempts');
  }

  private initializeTestWallet() {
    try {
      // Use hardcoded wallet details from the last successful generation
      this.walletMnemonic = "celery scale pen flash void flag boil casual purse property stumble old";
      this.walletPrivateKey = "c5926529a9cb388400fb6b7542e323e6ba39d6bc6dd234cfc22bc66675a025d3";
      
      const walletData: SavedWalletData = {
        id: 1,
        name: 'Test Inscription Wallet',
        privateKey: this.walletPrivateKey,
        mnemonic: this.walletMnemonic,
        derivedPath: "m/44'/972/0'/0/0"
      };
      
      // Initially create wallet with loadBalance true
      this.testWallet = new AppWallet(walletData, true, this.networkActions);
      console.log('Created wallet:', {
        address: this.testWallet.getAddress()
      });
    } catch (error) {
      console.error('Wallet creation failed:', error);
      throw error;
    }
  }

  private async checkWalletBalance(): Promise<void> {
    if (!this.testWallet) {
      throw new Error('Wallet not initialized');
    }

    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        // Check balance
        const balance = await this.transactionManager.getWalletTotalBalanceAndUtxos(this.testWallet.getAddress());
        console.log('Wallet balance:', balance);

        if (balance.totalBalance <= 0n) {
          throw new Error(`Insufficient balance. Please send some testnet KAS to ${this.testWallet.getAddress()}`);
        }

        // Verify UTXO context is ready
        const utxoProcessor = this.transactionManager.getUtxoProcessorManager();
        if (!utxoProcessor) {
          throw new Error('UTXO processor not initialized');
        }

        const context = utxoProcessor.getContext();
        if (!context) {
          throw new Error('UTXO context not ready');
        }

        console.log('UTXO context verified successfully');
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Balance check failed (${retries} retries remaining):`, error);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError || new Error('Failed to verify wallet balance and UTXO context after multiple attempts');
  }

  async testTextInscription() {
    try {
      await this.checkWalletBalance();
      if (!this.testWallet) throw new Error('Wallet not initialized');

      this.textResult = await this.transactionManager.createTextInscription(
        this.testWallet,
        "Hello Kaspa World!",
        0n
      );
      console.log('Text Inscription Result:', this.textResult);
    } catch (error: any) {
      console.error('Text inscription failed:', error);
      this.textResult = { 
        error: error.message || 'Unknown error occurred',
        errorCode: error.code || 'No error code'
      };
    }
  }

  async testDomainInscription() {
    try {
      await this.checkWalletBalance();
      if (!this.testWallet) throw new Error('Wallet not initialized');

      const balance = await this.transactionManager.getWalletTotalBalanceAndUtxos(this.testWallet.getAddress());
      if (balance.totalBalance <= MINIMAL_AMOUNT_TO_SEND * 2n) {
        throw new Error(`Insufficient balance for domain registration. Please send some testnet KAS to ${this.testWallet.getAddress()}`);
      }

      this.domainResult = await this.transactionManager.createDomainInscription(
        this.testWallet,
        "test123",
        "kas",
        0n
      );
      console.log('Domain Inscription Result:', this.domainResult);
    } catch (error: any) {
      console.error('Domain inscription failed:', error);
      this.domainResult = { 
        error: error.message || 'Unknown error occurred',
        errorCode: error.code || 'No error code'
      };
    }
  }

  async testBinaryInscription() {
    try {
      await this.checkWalletBalance();
      if (!this.testWallet) throw new Error('Wallet not initialized');

      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in binary
      this.binaryResult = await this.transactionManager.createBinaryInscription(
        this.testWallet,
        binaryData,
        "text/plain",
        0n
      );
      console.log('Binary Inscription Result:', this.binaryResult);
    } catch (error: any) {
      console.error('Binary inscription failed:', error);
      this.binaryResult = { 
        error: error.message || 'Unknown error occurred',
        errorCode: error.code || 'No error code'
      };
    }
  }
}
