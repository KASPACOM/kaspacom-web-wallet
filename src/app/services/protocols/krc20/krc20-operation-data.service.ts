import { Injectable } from '@angular/core';
import {
  KRC20OperationDataInterface,
  KRC20OperationType,
} from '../../../types/kaspa-network/krc20-operations-data.interface';

export const KRC20_TRANSACTIONS_PRICE = {
  DEPLOY: 100000000000n,
  MINT: 100000000n,
  TRANSFER: 0n,
};

export const KASPA_AMOUNT_FOR_LIST_KRC20_ACTION = 200000000n;

@Injectable({
  providedIn: 'root',
})
export class Krc20OperationDataService {
  getTransferData(
    ticker: string,
    amount: bigint,
    to: string
  ): KRC20OperationDataInterface {
    return {
      p: 'krc-20',
      op: KRC20OperationType.TRANSFER,
      tick: ticker.toLowerCase(),
      to: to,
      amt: String(amount),
    };
  }

  // Need to check to see if works
  getMintData(ticker: string): KRC20OperationDataInterface {
    return {
      p: 'krc-20',
      op: KRC20OperationType.MINT,
      tick: ticker.toLowerCase(),
    };
  }

  getListData(ticker: string, amount: bigint): KRC20OperationDataInterface {
    return {
      p: 'krc-20',
      op: KRC20OperationType.LIST,
      tick: ticker.toLowerCase(),
      amt: String(amount),
    };
  }

  getSendData(ticker: string): KRC20OperationDataInterface {
    return {
      p: 'krc-20',
      op: KRC20OperationType.SEND,
      tick: ticker.toLowerCase(),
    };
  }

  getDeployData(
    ticker: string,
    max: bigint,
    lim: bigint,
    pre: bigint,
  ): KRC20OperationDataInterface {
    return {
      p: 'krc-20',
      op: KRC20OperationType.DEPLOY,
      tick: ticker.toLowerCase(),
      max: String(max),
      lim: String(lim),
      pre: String(pre),
    };
  }

  getPriceForOperation(type: KRC20OperationType): bigint {
    switch (type) {
      case KRC20OperationType.MINT:
        return KRC20_TRANSACTIONS_PRICE.MINT;
      case KRC20OperationType.DEPLOY:
        return KRC20_TRANSACTIONS_PRICE.DEPLOY;
      case KRC20OperationType.TRANSFER:
        return KRC20_TRANSACTIONS_PRICE.TRANSFER;
      case KRC20OperationType.LIST:
        return KRC20_TRANSACTIONS_PRICE.TRANSFER;
      case KRC20OperationType.SEND:
        return KRC20_TRANSACTIONS_PRICE.TRANSFER;
      default:
        throw new Error('Invalid operation type');
    }
  }
}
