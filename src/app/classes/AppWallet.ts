import {
  effect,
  EffectRef,
  runInInjectionContext,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { PrivateKey } from '../../../public/kaspa/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SavedWalletData } from '../types/saved-wallet-data';
import { TotalBalanceWithUtxosInterface } from '../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoProcessorManager } from './UtxoProcessorManager';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';

export class AppWallet {
  private id: number;
  private name: string;
  private privateKey: PrivateKey;
  private mnemonic?: string;
  private derivedPath?: string;
  private balanceSignal: WritableSignal<
    undefined | TotalBalanceWithUtxosInterface
  > = signal(undefined);
  private utxoProcessorManager: UtxoProcessorManager | undefined = undefined;
  private isSettingUtxoProcessorManager = false;
  private walletStateBalance: Signal<undefined | BalanceData> | undefined = undefined;

  constructor(
    savedWalletData: SavedWalletData,
    private kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {
    this.id = savedWalletData.id;
    this.name = savedWalletData.name;
    this.privateKey = new PrivateKey(savedWalletData.privateKey);
    this.mnemonic = savedWalletData.mnemonic;
    this.derivedPath = savedWalletData.derivedPath;
    this.kaspaNetworkActionsService
      .getWalletBalanceAndUtxos(this.getAddress())
      .then((value) => this.balanceSignal.set(value))
      .catch(() => {
        console.error('Failed to load balance for wallet ' + this.getAddress());
      });
  }

  getId(): number {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getPrivateKey(): PrivateKey {
    return this.privateKey;
  }

  getAddress(): string {
    return this.kaspaNetworkActionsService.convertPrivateKeyToAddress(
      this.privateKey.toString()
    );
  }

  getMnemonic(): string | undefined {
    return this.mnemonic;
  }

  getDerivedPath(): string | undefined {
    return this.derivedPath;
  }

  getTotalBalanceAsSignal(): number | undefined {
    return this.balanceSignal() === undefined
      ? undefined
      : this.kaspaNetworkActionsService.sompiToNumber(
          this.balanceSignal()!.totalBalance
        );
  }

  async startListiningToWalletActions() {
    if (
      this.kaspaNetworkActionsService.getConnectionStatusSignal()() !==
      RpcConnectionStatus.CONNECTED
    ) {
      return;
    }

    if (!this.isSettingUtxoProcessorManager) {
      this.isSettingUtxoProcessorManager = true;
      this.utxoProcessorManager =
        await this.kaspaNetworkActionsService.initUtxoProcessorManager(
          this.getAddress()
        );

      this.walletStateBalance = this.utxoProcessorManager.getUtxoBalanceStateSignal();
    }
  }

  async stopListiningToWalletActions() {
    await this.utxoProcessorManager?.dispose();
    this.utxoProcessorManager = undefined;
    this.isSettingUtxoProcessorManager = false;
    this.walletStateBalance = undefined;
  }

  getUtxoProcessorManager(): UtxoProcessorManager | undefined {
    return this.utxoProcessorManager;
  }

  // This is only update once
  getBalanaceSignal(): Signal<undefined | TotalBalanceWithUtxosInterface> {
    return this.balanceSignal.asReadonly();
  }

  // This is keeps updating
  getWalletUtxoStateBalanceSignal(): Signal<undefined | BalanceData> {
    return this.walletStateBalance || signal(undefined);
  }
}
