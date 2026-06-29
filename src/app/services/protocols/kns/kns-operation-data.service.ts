import { Injectable } from '@angular/core';
import {
  KnsCreate,
  KnsList,
  KnsSend,
  KnsTransfer,
  KnsOperationType
} from '../../../types/kaspa-network/kns-operations-data.interface';

export const KNS_TRANSACTIONS_PRICE = {
  CREATE: 300000n,
  TRANSFER: 0n,
  LIST: 0n,
  SEND: 0n,
};

@Injectable({
  providedIn: 'root',
})
export class KnsOperationDataService {
  
  getCreateData(
    domain: string,
    isDomain: boolean,
    textRecords?: { [key: string]: string }
  ): KnsCreate {
    const createData: KnsCreate = {
      op: KnsOperationType.CREATE,
      v: domain,
    };

    // Only include 'p' field if it's a domain
    if (isDomain) {
      createData.p = 'domain';
    }

    if (textRecords && Object.keys(textRecords).length > 0) {
      createData.text = textRecords;
    }

    return createData;
  }

  getTransferData(assetId: string, isDomain: boolean, toAddress: string): KnsTransfer {
    const transferData: KnsTransfer = {
      op: KnsOperationType.TRANSFER,
      id: assetId,
      to: toAddress,
    };

    // Only include 'p' field if it's a domain
    if (isDomain) {
      transferData.p = 'domain';
    }

    return transferData;
  }

  getListData(assetId: string): KnsList {
    return {
      op: KnsOperationType.LIST,
      p: 'domain',
      id: assetId,
    };
  }

  getSendData(assetId: string): KnsSend {
    return {
      op: KnsOperationType.SEND,
      id: assetId,
    };
  }
}
