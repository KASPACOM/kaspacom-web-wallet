import { Component, OnInit } from '@angular/core';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../../../classes/AppWallet';

interface CommitParams {
  priorityEntries: any[];
  entries: any[];
  outputs: { address: string, amount: number }[];
  changeAddress: string;
  priorityFee: number;
}

interface RevealParams {
  outputs: { address: string, amount: number }[];
  changeAddress: string;
  priorityFee: number;
}

@Component({
  selector: 'app-test-inscription',
  templateUrl: './test-inscription.component.html',
  styleUrls: ['./test-inscription.component.scss']
})
export class TestInscriptionComponent implements OnInit {
  commit: CommitParams = {
    priorityEntries: [],
    entries: [],
    outputs: [],
    changeAddress: '',
    priorityFee: 0.01
  };

  reveal: RevealParams = {
    outputs: [],
    changeAddress: '',
    priorityFee: 0.02
  };

  script = '';
  networkId = 'testnet-10';
  wallet?: AppWallet;

  constructor(private kaspaActions: KaspaNetworkActionsService) {}

  ngOnInit() {
    // Expose component to window for testing after initialization
    (window as any).testInscriptionComponent = this;
  }

  async initializeWallet() {
    // Initialize wallet with required parameters
    const walletData = {
      id: Date.now(),
      name: 'Test Wallet',
      privateKey: '', // Get from user input or generate
      address: '', // Get from user input or generate
      network: 'testnet-10',
      balance: 0n,
      utxoEntries: [],
      pendingUtxoEntries: [],
      utxoProcessorManager: null,
      mnemonic: '',
      derivedPath: ''
    };
    this.wallet = new AppWallet(walletData, true, this.kaspaActions);
  }

  async handleCommitReveal() {
    if (!this.wallet) {
      console.error('Wallet not initialized');
      return;
    }

    try {
      const results = await (window as any).kasware.submitCommitReveal(
        this.commit,
        this.reveal,
        this.script,
        this.networkId
      );
      console.log('CommitReveal results:', results);
    } catch (error) {
      console.error('Error in CommitReveal:', error);
    }
  }

  async getUtxoEntries() {
    if (!this.wallet) return;
    this.commit.entries = await (window as any).kasware.getUtxoEntries();
  }

  async getAccounts() {
    if (!this.wallet) return;
    const [address] = await (window as any).kasware.getAccounts();
    this.commit.changeAddress = address;
    this.reveal.changeAddress = address;
  }

  async getNetwork() {
    const network = await (window as any).kasware.getNetwork();
    switch (network) {
      case 'kaspa_mainnet':
        this.networkId = 'mainnet';
        break;
      case 'kaspa_testnet_11':
        this.networkId = 'testnet-11';
        break;
      case 'kaspa_testnet_10':
        this.networkId = 'testnet-10';
        break;
      case 'kaspa_devnet':
        this.networkId = 'devnet';
        break;
      default:
        this.networkId = 'testnet-10';
    }
  }
}
