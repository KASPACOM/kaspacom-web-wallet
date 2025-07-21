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
    assetId: string,
    isDomain: boolean,
    textRecords?: { [key: string]: string }
  ): KnsInscribe {
    const inscribeData: KnsInscribe = {
      op: KnsOperationType.INSCRIBE,
      id: assetId,
    };

    // Only include 'p' field if it's a domain
    if (isDomain) {
      inscribeData.p = 'domain';
    }

    if (textRecords && Object.keys(textRecords).length > 0) {
      inscribeData.text = textRecords;
    }

    return inscribeData;
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

  getUpdateData(
    assetId: string,
    isDomain: boolean,
    textRecords: { [key: string]: string }
  ): KnsUpdate {
    const updateData: KnsUpdate = {
      op: KnsOperationType.UPDATE,
      id: assetId,
      text: textRecords,
    };

    // Only include 'p' field if it's a domain
    if (isDomain) {
      updateData.p = 'domain';
    }

    return updateData;
  }
}