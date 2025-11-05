import { Injectable, Signal } from '@angular/core';
import { KnsDomainAsset } from '../kns-api/dtos/kns-domain.dto';
import { L1AssetType } from './enums/l1-asset-type.enum';
import { LoadMoreResult, L1_PAGINATION_CONFIG } from './interfaces/pagination-state.interface';
import { BaseL1ListService, L1LoadMoreStoreResult } from './base-l1-list.service';

@Injectable({
  providedIn: 'root'
})
export class KnsListService extends BaseL1ListService<KnsDomainAsset> {
  readonly domains: Signal<KnsDomainAsset[]>;

  constructor() {
    super(L1AssetType.KNS, L1_PAGINATION_CONFIG.kns);
    this.domains = this.getItemsSignal();
  }

  protected override loadMoreFromStore(): Promise<L1LoadMoreStoreResult> {
    return this.l1AssetsStore.loadMoreKnsDomains();
  }
}

