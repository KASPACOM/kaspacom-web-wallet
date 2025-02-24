import {
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { PrivateKey } from '../../../public/kaspa/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SavedWalletAccount, SavedWalletData } from '../types/saved-wallet-data';
import { TotalBalanceWithUtxosInterface } from '../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoProcessorManager } from './UtxoProcessorManager';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';

export class AppWallet {
  private id: number;
  private name: string;
  private accountData: SavedWalletAccount | undefined;
  private privateKey: PrivateKey;
  private version: number | undefined = undefined;
  private balanceSignal: WritableSignal<
    undefined | TotalBalanceWithUtxosInterface
  > = signal(undefined);
  private utxoProcessorManager: UtxoProcessorManager | undefined = undefined;
  private isSettingUtxoProcessorManager = false;
  private walletStateBalance: Signal<undefined | BalanceData> | undefined = undefined;
  private isCurrentlyActiveSingal = signal(false);

  private waitForWalletProcessorToBeReadyPromise: Promise<void> | undefined = undefined;
  private waitForWalletProcessorToBeReadyResolve: (() => void) | undefined = undefined;
  private isWaitForWalletProccessorResolved: boolean = false;

  constructor(
    savedWalletData: SavedWalletData,
    shoudLoadBalance: boolean,
    account: SavedWalletAccount | undefined,
    private kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {
    this.id = savedWalletData.id;
    this.name = savedWalletData.name;
    this.accountData = account;
    this.version = savedWalletData.version;

    if (!savedWalletData.privateKey && !savedWalletData.mnemonic) {
      throw new Error('Wallet must have a private key or a mnemonic');
    }

    if (savedWalletData.privateKey) {
      this.privateKey = new PrivateKey(savedWalletData.privateKey);
    } else {
      const memonicPk = this.kaspaNetworkActionsService.getPrivateKeyFromMnemonic(savedWalletData.mnemonic!, account!.derivedPath, savedWalletData.password);

      if (!memonicPk) {
        throw new Error('No memonic to this wallet data');
      }

      this.privateKey = new PrivateKey(memonicPk);
    }

    this.waitForWalletProcessorToBeReadyPromise = new Promise((res) => {
      this.waitForWalletProcessorToBeReadyResolve = res;
    })

    if (shoudLoadBalance) {
      this.refreshBalance();
    }
  }

  getId(): number {
    return this.id;
  }

  getIdWithAccount(): string {
    return `${this.id}-${this.accountData ? this.accountData.derivedPath : 'no-account'}`;
  }

  getDisplayName(): string {
    return this.accountData?.name ? `${this.name} (${this.accountData.name})` : this.name;
  }

  getName(): string {
    return this.name;
  }

  getAccountName(): string | undefined {
    return this.accountData?.name;
  }

  getDerivedPath(): string | undefined {
    return this.accountData?.derivedPath;
  }

  setName(name: string) {
    this.name = name;
  }

  getPrivateKey(): PrivateKey {
    return this.privateKey;
  }

  getAddress(): string {
    return this.kaspaNetworkActionsService.convertPrivateKeyToAddress(
      this.privateKey.toString()
    );
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
          this.getAddress(),
          async () => await this.refreshBalance(),
        );

      this.walletStateBalance = this.utxoProcessorManager.getUtxoBalanceStateSignal();
      this.waitForWalletProcessorToBeReadyResolve!();
      this.isWaitForWalletProccessorResolved = true;
    }
  }

  async stopListiningToWalletActions() {
    await this.utxoProcessorManager?.dispose();
    this.utxoProcessorManager = undefined;
    this.isSettingUtxoProcessorManager = false;
    this.walletStateBalance = undefined;

    if (this.isWaitForWalletProccessorResolved) {
      this.isWaitForWalletProccessorResolved = false;
      this.waitForWalletProcessorToBeReadyPromise = new Promise((res) => {
        this.waitForWalletProcessorToBeReadyResolve = res;
      })
    }

  }

  isCurrentlyActive(): boolean {
    return this.isCurrentlyActiveSingal();
  }

  setIsCurrentlyActive(isActive: boolean) {
    this.isCurrentlyActiveSingal.set(isActive);
  }

  getUtxoProcessorManager(): UtxoProcessorManager | undefined {
    return this.utxoProcessorManager;
  }

  // This is only update once
  getBalanceSignal(): Signal<undefined | TotalBalanceWithUtxosInterface> {
    return this.balanceSignal.asReadonly();
  }

  refreshBalance() {
    this.kaspaNetworkActionsService
      .getWalletBalanceAndUtxos(this.getAddress())
      .then((value) => this.balanceSignal.set(value))
      .catch(() => {
        console.error('Failed to load balance for wallet ' + this.getAddress());
      });
  }

  // This is keeps updating
  getWalletUtxoStateBalanceSignal(): Signal<undefined | BalanceData> {
    return this.walletStateBalance || signal(undefined);
  }

  waitForUtxoProcessorToBeReady(): Promise<void> {
    return this.waitForWalletProcessorToBeReadyPromise!;
  }

  supportAccounts(): boolean {
    return !!this.version;
  }
}
