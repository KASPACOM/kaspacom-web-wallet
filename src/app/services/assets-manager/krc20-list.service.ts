import { Injectable, Signal } from '@angular/core';
import { GetTokenListDto } from '../kasplex-api/dtos/token-list-info.dto';
import { L1AssetType } from './enums/l1-asset-type.enum';
import { LoadMoreResult, L1_PAGINATION_CONFIG } from './interfaces/pagination-state.interface';
import { BaseL1ListService, L1LoadMoreStoreResult } from './base-l1-list.service';

@Injectable({
  providedIn: 'root'
})
export class Krc20ListService extends BaseL1ListService<GetTokenListDto> {
  readonly tokens: Signal<GetTokenListDto[]>;

  constructor() {
    super(L1AssetType.KRC20, L1_PAGINATION_CONFIG.krc20);
    this.tokens = this.getItemsSignal();
  }

  protected override loadMoreFromStore(): Promise<L1LoadMoreStoreResult> {
    return this.l1AssetsStore.loadMoreKrc20Tokens();
  }
}

