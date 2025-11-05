import { Injectable, Signal } from '@angular/core';
import { Krc721Nft } from '../krc721-api/dtos/krc721-nft.dto';
import { L1AssetType } from './enums/l1-asset-type.enum';
import { LoadMoreResult, L1_PAGINATION_CONFIG } from './interfaces/pagination-state.interface';
import { BaseL1ListService, L1LoadMoreStoreResult } from './base-l1-list.service';

@Injectable({
  providedIn: 'root'
})
export class Krc721ListService extends BaseL1ListService<Krc721Nft> {
  readonly nfts: Signal<Krc721Nft[]>;

  constructor() {
    super(L1AssetType.KRC721, L1_PAGINATION_CONFIG.krc721);
    this.nfts = this.getItemsSignal();
  }

  protected override loadMoreFromStore(): Promise<L1LoadMoreStoreResult> {
    return this.l1AssetsStore.loadMoreKrc721Nfts();
  }
}

