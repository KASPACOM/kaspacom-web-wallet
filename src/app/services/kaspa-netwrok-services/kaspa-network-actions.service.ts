import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import { PrivateKey } from '../../../../public/kaspa/kaspa';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManager: KaspaNetworkTransactionsManagerService
  ) {}

  getConnectionStatusSignal() {
    return this.transactionsManager.getConnectionStatusSignal();
  }

  async getWalletBalanceAndUtxos(walletAddres: string) {
    return await this.transactionsManager.getWalletTotalBalanceAndUtxos(
      walletAddres
    );
  }

  kaspaToSompiFromNumber(value: number): bigint {
    return BigInt(
      Math.round(value * 1e8).toLocaleString('fullwide', { useGrouping: false })
    );
  }

  sompiToNumber(value: bigint): number {
    return Number(value) / 1e8;
  }

  convertPrivateKeyToAddress(privateKey: string): string {
    return this.transactionsManager.convertPrivateKeyToAddress(privateKey);
  }

  validatePrivateKey(privateKey: string) {
    try {
      console.log(privateKey, new PrivateKey(privateKey));
      new PrivateKey(privateKey);

      return true;
    } catch (error) {
      return false;
    }
  }
}
