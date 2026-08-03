import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DropdownOption,
  KcButtonComponent,
  KcDropdownSelectComponent,
  KcInputComponent,
} from '@kaspacom/ui-kit';
import { RpcService } from '../../../../../../../services/kaspa-netwrok-services/rpc.service';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
import { ContractDisplayService } from '../../services/contract-display.service';
import { IndexerImportPreview } from '../../contracts-page.models';

export type LookupInteractRequest = {
  contractJson: string;
  outpointTxid: string;
  outpointVout: string;
  inputAmount: string;
};

@Component({
  selector: 'app-contract-lookup-import',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcDropdownSelectComponent,
    CopyButtonComponent,
  ],
  templateUrl: './contract-lookup-import.component.html',
  styleUrl: './contract-lookup-import.component.scss',
})
export class ContractLookupImportComponent {
  private rpcService = inject(RpcService);
  display = inject(ContractDisplayService);

  // Indexer import preview — shell-owned (deep links like ?contract=... drive
  // these signals directly, outside this component, to auto-populate a
  // lookup when the page loads).
  indexerImportQuery = input('');
  indexerImportLoading = input(false);
  indexerImportError = input<string | null>(null);
  indexerImportPreview = input<IndexerImportPreview | null>(null);

  // Share panel — derived from the shell's dashboardContracts.
  shareableContractOptions = input<DropdownOption[]>([]);
  effectiveShareableContractId = input('');
  shareableContractLink = input('');

  indexerImportQueryChanged = output<string>();
  lookupIndexerImportRequested = output<void>();
  importIndexerPreviewRequested = output<void>();
  shareableContractChanged = output<string>();
  copyShareableContractLinkRequested = output<void>();

  // On-chain address lookup — fully local, no shell coupling needed.
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
  lookupContractJson = '';

  interactRequested = output<LookupInteractRequest>();

  onIndexerImportQueryChange(value: any) {
    this.indexerImportQueryChanged.emit(value || '');
  }

  onShareableContractChange(value: string) {
    this.shareableContractChanged.emit(value || '');
  }

  onLookupAddressChange(value: any) {
    this.lookupAddress = value || '';
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

      const utxoResponse = await rpc.getUtxosByAddresses({
        addresses: [address],
      });
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
    } catch (err: any) {
      console.error('[Lookup] Failed:', err);
      this.lookupError.set(err?.message || 'Failed to query contract address');
    } finally {
      this.lookupLoading.set(false);
    }
  }

  /**
   * Hand the looked-up contract JSON + active UTXO off to the shell, which
   * owns the interact/action-panel state and switches to that tab.
   */
  importLookupContract() {
    const result = this.lookupResult();
    if (!result || (result.utxos || []).length === 0) return;
    if (!this.lookupContractJson) return;

    this.interactRequested.emit({
      contractJson: this.lookupContractJson,
      outpointTxid: result.utxos[0].txid,
      outpointVout: String(result.utxos[0].vout),
      inputAmount: result.utxos[0].amount,
    });
  }
}
