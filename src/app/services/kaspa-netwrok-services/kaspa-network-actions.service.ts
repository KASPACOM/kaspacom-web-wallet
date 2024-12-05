import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import {
  IPaymentOutput,
  Mnemonic,
  PrivateKey,
  XPrv,
} from '../../../../public/kaspa/kaspa';
import { Injectable, Signal } from '@angular/core';
import { DEFAULT_DERIVED_PATH, ERROR_CODES } from '../../config/consts';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import {
  TransferKasAction,
  WalletAction,
  WalletActionType,
} from '../../types/wallet-action';
import { WalletService } from '../wallet.service';
import { AppWallet } from '../../classes/AppWallet';

const MINIMAL_TRANSACTION_MASS = 10000n;
export const MINIMAL_AMOUNT_TO_SEND = 20000000n;
const KASPA_AMOUNT_FOR_KRC20_ACTION = 300000000n;
@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManager: KaspaNetworkTransactionsManagerService,
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

  async doWalletAction(action: WalletAction, wallet: AppWallet): Promise<{
    success: boolean;
    errorCode?: number;
    result?: any;
  }> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      const actionData = action.data as TransferKasAction;
      const payments: IPaymentOutput[] = [
        {
          address: actionData.to,
          amount: actionData.amount,
        },
      ];

      return await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
        wallet,
        payments,
        action.priorityFee || 0n,
        actionData.sendAll
      );
    }

    return {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    }
  }

  async getMinimalRequiredAmountForAction(
    action: WalletAction
  ): Promise<bigint> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      return (
        action.data.amount +
        (action.priorityFee || 0n) +
        MINIMAL_TRANSACTION_MASS
      );
    }

    if (action.type === WalletActionType.KRC20_ACTION) {
      return (
        action.data.amount +
        (action.priorityFee || 0n) +
        MINIMAL_TRANSACTION_MASS
      );
    }

    throw new Error('Invalid action type');
  }
}
