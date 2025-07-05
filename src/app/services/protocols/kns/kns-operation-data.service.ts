import { Injectable } from '@angular/core';
import {
  KnsInscribe,
  KnsTransfer,
  KnsUpdate,
  KnsOperationType
} from '../../../types/kaspa-network/kns-operations-data.interface';

export const KNS_TRANSACTIONS_PRICE = {
  INSCRIBE: 300000n,
  TRANSFER: 100000n,
  UPDATE: 100000n,
};

@Injectable({
  providedIn: 'root',
})
export class KnsOperationDataService {
  
  getInscribeData(
    domainName: string,
    textRecords?: { [key: string]: string }
  ): KnsInscribe {
    const inscribeData: KnsInscribe = {
      p: 'kns',
      op: KnsOperationType.INSCRIBE,
      name: domainName,
    };

    if (textRecords && Object.keys(textRecords).length > 0) {
      inscribeData.text = textRecords;
    }

    return inscribeData;
  }

  getTransferData(domainName: string, toAddress: string): KnsTransfer {
    return {
      p: 'kns',
      op: KnsOperationType.TRANSFER,
      name: domainName,
      to: toAddress,
    };
  }

  getUpdateData(
    domainName: string,
    textRecords: { [key: string]: string }
  ): KnsUpdate {
    return {
      p: 'kns',
      op: KnsOperationType.UPDATE,
      name: domainName,
      text: textRecords,
    };
  }
}