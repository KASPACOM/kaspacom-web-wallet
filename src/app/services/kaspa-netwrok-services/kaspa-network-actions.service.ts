import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import {
  Mnemonic,
  PrivateKey,
  UtxoProcessor,
  XPrv,
} from '../../../../public/kaspa/kaspa';
import { effect, Injectable, Signal } from '@angular/core';
import { DEFAULT_DERIVED_PATH } from '../../config/consts';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManager: KaspaNetworkTransactionsManagerService
  ) {}

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
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
      new PrivateKey(privateKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  getPrivateKeyFromMnemonic(
    mnemonicWords: string,
    derivedPath: string = DEFAULT_DERIVED_PATH,
    password?: string
  ): string | null {
    const isValid = Mnemonic.validate(mnemonicWords);

    if (!isValid) {
      return null;
    }

    const mnemonic = new Mnemonic(mnemonicWords);

    const seed = mnemonic.toSeed(password);
    const xprv = new XPrv(seed);

    if (derivedPath) {
      return xprv.derivePath(derivedPath).toPrivateKey().toString();
    }

    return xprv.privateKey;
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string
  ): string | null {
    const privateKey = this.getPrivateKeyFromMnemonic(
      mnemonic,
      DEFAULT_DERIVED_PATH,
      password
    );
    return privateKey ? this.convertPrivateKeyToAddress(privateKey) : null;
  }

  generateMnemonic(wordsCount: number): string {
    return Mnemonic.random(wordsCount).phrase;
  }

  async initUtxoProcessorManager(
    address: string
  ): Promise<UtxoProcessorManager> {
    return await this.transactionsManager.initUtxoProcessorManager(address);
  }
}
