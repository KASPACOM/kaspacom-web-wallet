import { HttpClient, HttpParams } from '@angular/common/http';
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
  classificationKind?: string | null;
  classificationStatus?: string | null;
  covenantIdHex?: string;
  decodedArgs?: Record<string, any> | null;
  entrypoint?: string | null;
  inputs?: Record<string, any> | null;
  outputs?: {
    address?: string;
    amountSompi?: number | string;
    scriptPubKeyHex?: string;
    state?: Record<string, any> | null;
    vout?: number;
  } | null;
  scriptHashHex?: string;
  txidHex?: string;
}

export interface IndexerCovenantDetails {
  address?: string;
  activeUtxos?: number;
  canonicalCovenantIdKnown?: boolean;
  claimedArgs?: {
    args?: IndexerCovenantArg[];
    tmpl?: string;
  } | null;
  claimedTemplate?: string | null;
  claimVerified?: boolean;
  classificationKind?: string | null;
  classificationStatus?: string | null;
  constructor?: Record<string, any> | null;
  covenantIdHex?: string;
  createdAtMs?: number;
  decodedArgs?: Record<string, any> | null;
  genesisTxidHex?: string;
  identitySource?: string;
  totalAmountSompi?: number | string;
  scriptHashHex?: string;
  template?: string | null;
}

export interface IndexerCovenantResponse {
  actions?: IndexerCovenantAction[];
  covenant?: IndexerCovenantDetails;
  events?: IndexerCovenantAction[];
}

export interface IndexerCovenantUtxo {
  address?: string;
  amountSompi?: number | string;
  covenantIdHex?: string;
  scriptHashHex?: string;
  spentByTxidHex?: string | null;
  state?: Record<string, any> | null;
  status?: string;
  txidHex?: string;
  vout?: number;
}

export interface IndexerCovenantListParams {
  template?: string;
  verified_only?: boolean;
  classification?: string;
  classificationStatus?: string;
  claimArg?: string;
  claimArgValue?: string;
  wallet?: string;
  walletArg?: string;
  covenantId?: string;
  q?: string;
  active?: boolean;
  sort?: 'recent' | 'active' | 'amount' | 'template' | string;
  limit?: number;
  offset?: number;
}

export interface IndexerSearchResult {
  description?: string | null;
  id?: string | null;
  kind: 'covenant' | 'transaction' | 'address' | 'kcc20' | string;
  label: string;
  path: string;
  score: number;
  status?: string | null;
}

export interface IndexerTxSettlementStatus {
  indexed: boolean;
  indexedAtMs?: string | null;
  indexerStatus?: string | null;
  scanner?: Record<string, any>;
  txidHex: string;
}

@Injectable({
  providedIn: 'root',
})
export class CovenantIndexerService {
  constructor(
    private readonly http: HttpClient,
    private readonly kaspaL1NetworkService: KaspaL1NetworkService,
  ) {}

  async listCovenants(params: IndexerCovenantListParams = {}): Promise<IndexerCovenantDetails[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantDetails[]>(`${this.getBaseUrl()}/covenants`, {
        params: this.toHttpParams(params),
      }),
    );
  }

  async getCovenant(covenantId: string): Promise<IndexerCovenantResponse> {
    return firstValueFrom(
      this.http.get<IndexerCovenantResponse>(`${this.getBaseUrl()}/covenants/${covenantId}`),
    );
  }

  async getCovenantByCanonicalId(covenantId: string): Promise<IndexerCovenantResponse> {
    return firstValueFrom(
      this.http.get<IndexerCovenantResponse>(`${this.getBaseUrl()}/covenants/by-id/${covenantId}`),
    );
  }

  async getCovenantActions(covenantIdOrScriptHash: string): Promise<IndexerCovenantAction[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantAction[]>(`${this.getBaseUrl()}/covenants/${covenantIdOrScriptHash}/actions`),
    );
  }

  async getCovenantUtxos(covenantIdOrScriptHash: string): Promise<IndexerCovenantUtxo[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantUtxo[]>(`${this.getBaseUrl()}/covenants/${covenantIdOrScriptHash}/utxos`),
    );
  }

  async getAddressEvents(address: string, limit = 50): Promise<IndexerCovenantAction[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantAction[]>(`${this.getBaseUrl()}/addresses/${address}/events`, {
        params: this.toHttpParams({ limit }),
      }),
    );
  }

  async getTransactionActions(txid: string): Promise<IndexerCovenantAction[]> {
    return firstValueFrom(
      this.http.get<IndexerCovenantAction[]>(`${this.getBaseUrl()}/tx/${txid}`),
    );
  }

  async getTransactionSettlementStatus(txid: string): Promise<IndexerTxSettlementStatus> {
    return firstValueFrom(
      this.http.get<IndexerTxSettlementStatus>(`${this.getBaseUrl()}/tx/${txid}/settlement-status`),
    );
  }

  async search(query: string, limit = 10): Promise<IndexerSearchResult[]> {
    return firstValueFrom(
      this.http.get<IndexerSearchResult[]>(`${this.getBaseUrl()}/explorer/search`, {
        params: this.toHttpParams({ q: query, limit }),
      }),
    );
  }

  private toHttpParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  private getBaseUrl(): string {
    const baseUrl = this.kaspaL1NetworkService.getCovenantIndexerApiBaseurl();
    if (!baseUrl) {
      throw new Error(`Covenant indexer import is not available for ${this.kaspaL1NetworkService.getNetworkId()}.`);
    }

    return baseUrl.replace(/\/+$/, '');
  }
}
