import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicKey, XOnlyPublicKey } from '../../../../../public/kaspa/kaspa';
import { knsInscriptionService } from '../../../services/kaspa-netwrok-services/kns-inscription.service';

interface DomainInscription {
  domain: string;
  status: 'pending' | 'success' | 'error';
  txid?: string;
  error?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-test-inscription',
  template: `
    <div class="card">
      <div class="card-header">Test Multiple KNS Inscriptions</div>
      <div class="card-body">
        <div class="alert alert-info" *ngIf="!kasware">
          Please install Kasware wallet to proceed.
        </div>

        <!-- Protocol info -->
        <div class="mb-3">
          <div><strong>Type:</strong> Commit & Reveal</div>
          <div><strong>Inscription Protocol:</strong> domain</div>
          <div><strong>Inscription:</strong> KNS Domain Registration</div>
        </div>

        <div *ngFor="let inscription of inscriptions; let i = index" class="mb-3 p-3 border rounded">
          <div class="d-flex justify-content-between align-items-center">
            <strong>{{inscription.domain}}.kas</strong>
            <span [class]="getStatusClass(inscription.status)">{{inscription.status}}</span>
          </div>
          
          <div *ngIf="inscription.txid" class="small text-break mt-2">
            Transaction ID: {{inscription.txid}}
          </div>
          
          <div *ngIf="inscription.error" class="small text-danger mt-2">
            Error: {{inscription.error}}
          </div>
        </div>

        <button 
          class="btn btn-primary mt-3"
          (click)="processInscriptions()"
          [disabled]="isButtonDisabled()"
        >
          <span>{{getButtonText()}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card { max-width: 600px; margin: 1rem; }
    .text-break { word-break: break-all; }
    .status-pending { color: #f90; }
    .status-success { color: #0a0; }
    .status-error { color: #d00; }
  `]
})
export class TestInscriptionComponent implements OnInit {
  kasware: any;
  loading = false;
  inscriptions: DomainInscription[] = [
    { domain: 'irobot', status: 'pending' },
    { domain: 'askdsa', status: 'pending' },
    { domain: 'niii', status: 'pending' },
    { domain: 'zay', status: 'pending' }
  ];

  constructor() {}

  ngOnInit() {
    this.initializeKasware();
  }

  private async initializeKasware() {
    this.kasware = (window as any).kasware;
    
    if (!this.kasware) {
      for (let i = 1; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100 * i));
        this.kasware = (window as any).kasware;
        if (this.kasware) break;
      }
    }
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  isButtonDisabled(): boolean {
    return this.loading || this.inscriptions.every(i => i.status === 'success');
  }

  getButtonText(): string {
    return this.loading ? 'Processing...' : 'Create Inscriptions';
  }

  async processInscriptions() {
    if (!this.kasware) {
      alert('Please install Kasware wallet');
      return;
    }

    this.loading = true;

    try {
      // Get accounts first
      let accounts = await this.kasware.getAccounts();
      console.log('Retrieved accounts:', accounts);
      
      // If not connected, request connection
      if (!accounts || accounts.length === 0) {
        try {
          accounts = await this.kasware.requestAccounts();
          console.log('Requested accounts:', accounts);
        } catch (e) {
          throw new Error('Failed to connect to Kasware wallet. Please ensure it is unlocked and try again.');
        }
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      const [address] = accounts;
      console.log('Using address:', address);
      
      // Get public key
      const publicKeyStr = await this.kasware.getPublicKey();
      console.log('Raw public key:', publicKeyStr);

      if (!publicKeyStr) {
        throw new Error('No public key returned from Kasware');
      }

      // Clean and validate public key
      const cleanPublicKey = publicKeyStr.startsWith('0x') ? 
        publicKeyStr.slice(2) : publicKeyStr;
      console.log('Cleaned public key:', cleanPublicKey);

      if (!cleanPublicKey) {
        throw new Error('Invalid public key format');
      }

      let publicKey: XOnlyPublicKey;
      try {
        if (cleanPublicKey.length === 64) {
          publicKey = new XOnlyPublicKey(cleanPublicKey);
        } else {
          const pubKey = new PublicKey(cleanPublicKey);
          publicKey = pubKey.toXOnlyPublicKey();
        }
        console.log('Final XOnlyPublicKey:', publicKey.toString());
      } catch(e) {
        throw new Error(`Invalid public key format: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }

      const network = await this.kasware.getNetwork();
      console.log('Network:', network);

      const entries = await this.kasware.getUtxoEntries();
      console.log('UTXO Entries:', entries);

      // Process each inscription sequentially
      for (const inscription of this.inscriptions) {
        if (inscription.status === 'success') continue;
        console.log('\nProcessing inscription for domain:', inscription.domain);

        try {
          const p2shAddress = "kaspatest:qq9h47etjv6x8jgcla0ecnp8mgrkfxm70ch3k60es5a50ypsf4h6sak3g0lru";
          const { script, commitData, revealData, networkId } = await knsInscriptionService.createDomainInscription(
            inscription.domain,
            publicKey,
            entries,
            address,
            network
          );

          console.log('\nInscription preparation data:');
          console.log('Script:', script);
          console.log('NetworkId:', networkId);
          console.log('Original commit data:', JSON.stringify(commitData, null, 2));
          console.log('Original reveal data:', JSON.stringify(revealData, null, 2));

          // Format the commit/reveal data as expected by KasWare
          const commit = {
            priorityEntries: [],
            entries: entries,
            outputs: commitData.outputs,
            changeAddress: address,
            priorityFee: 0.01,
            type: 'commit',
            inscriptionProtocol: 'domain'
          };

          const reveal = {
            outputs: [
              {
                address: p2shAddress,
                amount: revealData.outputs[0].amount
              }
            ],
            changeAddress: address,
            priorityFee: 0.02,
            type: 'reveal',
            inscriptionProtocol: 'domain'
          };

          console.log('\nFormatted transaction data for KasWare:');
          console.log('Commit:', JSON.stringify(commit, null, 2));
          console.log('Reveal:', JSON.stringify(reveal, null, 2));

          // Submit using KasWare's submitCommitReveal method
          console.log('\nSubmitting to KasWare...');
          const result = await this.kasware.submitCommitReveal(
            commit,
            reveal,
            script,
            networkId
          );
          console.log('KasWare response:', result);

          if (result && (result.commitTxId || result.revealTxId)) {
            inscription.status = 'success';
            inscription.txid = JSON.stringify(result, null, 2);
          } else {
            throw new Error('Invalid response from Kasware');
          }
        } catch (error: any) {
          console.error('Detailed error for inscription:', inscription.domain, error);
          inscription.status = 'error';
          inscription.error = error.message || 'Unknown error occurred';
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error('Global error:', error);
      this.inscriptions.forEach(inscription => {
        if (inscription.status === 'pending') {
          inscription.status = 'error';
          inscription.error = error.message || 'Global error occurred';
        }
      });
    } finally {
      this.loading = false;
    }
  }
}