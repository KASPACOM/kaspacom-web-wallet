import { Injectable } from '@angular/core';
import {
  Krc721Deploy,
  Krc721Mint,
  Krc721Transfer,
  Krc721List,
  Krc721Send,
  Krc721OperationType
} from '../../../types/kaspa-network/krc721-operations-data.interface';

export const KRC721_TRANSACTIONS_PRICE = {
  DEPLOY: 500000n,
  MINT: 200000n,
  TRANSFER: 0n,
};

@Injectable({
  providedIn: 'root',
})
export class Krc721OperationDataService {

  getDeployData(
    ticker: string,
    maxSupply: string,
    limit?: string,
    preAllocation?: string,
    toAddress?: string,
    decimals?: string,
    schema?: string,
    baseUri?: string,
    startTime?: string
  ): Krc721Deploy {
    const deployData: Krc721Deploy = {
      p: 'krc-721',
      op: Krc721OperationType.DEPLOY,
      tick: ticker,
      max: maxSupply,
    };

    if (limit) deployData.lim = limit;
    if (preAllocation) deployData.pre = preAllocation;
    if (toAddress) deployData.to = toAddress;
    if (decimals) deployData.dec = decimals;
    if (schema) deployData.sch = schema;
    if (baseUri) deployData.buri = baseUri;
    if (startTime) deployData.st = startTime;

    return deployData;
  }

  getMintData(ticker: string, toAddress?: string): Krc721Mint {
    const mintData: Krc721Mint = {
      p: 'krc-721',
      op: Krc721OperationType.MINT,
      tick: ticker,
    };

    if (toAddress) {
      mintData.to = toAddress;
    }

    return mintData;
  }

  getTransferData(ticker: string, tokenId: string, toAddress: string): Krc721Transfer {
    return {
      p: 'krc-721',
      op: Krc721OperationType.TRANSFER,
      tick: ticker,
      to: toAddress,
      tokenId: tokenId,
    };
  }

  getListData(ticker: string, tokenId: string): Krc721List {
    return {
      p: 'krc-721',
      op: Krc721OperationType.LIST,
      tick: ticker.toLowerCase(),
      tokenId: tokenId,
    };
  }

  getSendData(ticker: string, tokenId: string): Krc721Send {
    return {
      p: 'krc-721',
      op: Krc721OperationType.SEND,
      tick: ticker.toLowerCase(),
      tokenId: tokenId,
    };
  }
}