import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';

export interface IndexerCovenantArg {
  name: string;
  type: string;
  value: string;
}

export interface IndexerCovenantAction {
  action?: string;
  address?: string;
  blockTimeMs?: number;
  covenantIdHex?: string;
  outputs?: {
    address?: string;
    amountSompi?: number | string;
    scriptPubKeyHex?: string;
    vout?: number;
  } | null;
  txidHex?: string;
}

export interface IndexerCovenantDetails {
  address?: string;
  claimedArgs?: {
    args?: IndexerCovenantArg[];
    tmpl?: string;
  } | null;
  claimedTemplate?: string | null;
  covenantIdHex?: string;
  createdAtMs?: number;
  genesisTxidHex?: string;
  totalAmountSompi?: number | string;
  scriptHashHex?: string;
}

export interface IndexerCovenantResponse {
  actions?: IndexerCovenantAction[];
  covenant?: IndexerCovenantDetails;
}

@Injectable({
  providedIn: 'root',
})
export class CovenantIndexerService {
  constructor(
    private readonly http: HttpClient,
    private readonly kaspaL1NetworkService: KaspaL1NetworkService,
  ) {}

  async getCovenant(covenantId: string): Promise<IndexerCovenantResponse> {
    return firstValueFrom(
      this.http.get<IndexerCovenantResponse>(`${this.getBaseUrl()}/covenants/${covenantId}`),
    );
  }

  async getTransactionActions(txid: string): Promise<IndexerCovenantAction[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantAction[]>(`${this.getBaseUrl()}/tx/${txid}`),
    );
  }

  private getBaseUrl(): string {
    const baseUrl = this.kaspaL1NetworkService.getCovenantIndexerApiBaseurl();
    if (!baseUrl) {
      throw new Error(`Covenant indexer import is not available for ${this.kaspaL1NetworkService.getNetworkId()}.`);
    }

    return baseUrl.replace(/\/+$/, '');
  }
}
