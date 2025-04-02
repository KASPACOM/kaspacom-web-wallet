import {
  EnvironmentInjector,
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
import { MempoolTransactionManager } from './MempoolTransactionManager';
import { IMempoolResultEntry } from '../types/kaspa-network/mempool-result.interface';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { KasplexL2Service } from '../services/kasplex-l2.service';

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
  private mempoolTransactionsManager: MempoolTransactionManager | undefined = undefined;
  private isSettingUtxoProcessorManager = false;
  private walletStateBalance: WritableSignal<undefined | BalanceData> = signal(undefined);
  private mempoolTransactionsSignal: WritableSignal<IMempoolResultEntry | undefined> = signal(undefined);
  private isCurrentlyActiveSingal = signal(false);
  private kasplexL2ServiceWalletAddress: WritableSignal<string | undefined> = signal(undefined);
  private currentMempoolManagerTransactionSignalSubscription: undefined | Subscription = undefined;
  private currentUtxoProcessorManagerTransactionSignalSubscription: undefined | Subscription = undefined;


  // Promises
  private utxoProcessorManagerPendingUtxoPromise: Promise<unknown> | undefined = undefined;
  private utxoProcessorManagerPendingUtxoResolve: undefined | ((v?: any) => void) = undefined;
  private mempoolTransactionsManagerPendingPromise: Promise<unknown> | undefined = undefined;
  private mempoolTransactionsManagerPendingResolve: undefined | ((v?: any) => void) = undefined;

  constructor(
    savedWalletData: SavedWalletData,
    shoudLoadBalance: boolean,
    account: SavedWalletAccount | undefined,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly injector: EnvironmentInjector,
    private readonly kasplexL2Service: KasplexL2Service,
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

    this.utxoProcessorManagerPendingUtxoPromise = new Promise((resolve) => {
      this.utxoProcessorManagerPendingUtxoResolve = resolve;
    });

    this.mempoolTransactionsManagerPendingPromise = new Promise((resolve) => {
      this.mempoolTransactionsManagerPendingResolve = resolve;
    });

    if (shoudLoadBalance) {
      this.refreshUtxosBalance();
    }

    this.initializeKasplexL2ServiceWalletAddress();
  }

  private async initializeKasplexL2ServiceWalletAddress() {
    const address = await this.getKasplexL2ServiceWallet().getAddress();
    this.kasplexL2ServiceWalletAddress.set(address);
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

    if (!this.mempoolTransactionsManager) {
      this.mempoolTransactionsManager = await this.kaspaNetworkActionsService.initMempoolTransactionManager(this.getAddress());
      this.currentMempoolManagerTransactionSignalSubscription = toObservable(this.mempoolTransactionsManager.getWalletMempoolTransactionsSignal(), { injector: this.injector }).subscribe((mempoolTransactionData) => {
        this.mempoolTransactionsSignal.set(mempoolTransactionData);

        if (mempoolTransactionData) {
          if (mempoolTransactionData.sending.length > 0 && !this.mempoolTransactionsManagerPendingPromise) {
            this.mempoolTransactionsManagerPendingPromise = new Promise((resolve) => {
              this.mempoolTransactionsManagerPendingResolve = resolve;
            })
          }
          
          if (mempoolTransactionData.sending.length == 0 && this.mempoolTransactionsManagerPendingPromise) {
            this.mempoolTransactionsManagerPendingResolve?.();
            this.mempoolTransactionsManagerPendingPromise = undefined;
            this.mempoolTransactionsManagerPendingResolve = undefined;
          }
        }
      },
      );
    }

    if (!this.isSettingUtxoProcessorManager) {
      this.isSettingUtxoProcessorManager = true;
      this.utxoProcessorManager =
        await this.kaspaNetworkActionsService.initUtxoProcessorManager(
          this.getAddress(),
        );

      this.currentUtxoProcessorManagerTransactionSignalSubscription = toObservable(this.utxoProcessorManager.getUtxoBalanceStateSignal(), { injector: this.injector }).subscribe((balanceData) => {
        this.walletStateBalance.set(balanceData);
        this.refreshUtxosBalance();
        if (this.getCurrentWalletStateBalanceSignalValue() && (this.getCurrentWalletStateBalanceSignalValue()!.outgoing > 0n || this.getCurrentWalletStateBalanceSignalValue()!.pending > 0n)) {
          this.mempoolTransactionsManager?.refreshMempoolTransactions();
        }

        if (balanceData) {
          if ((balanceData.outgoing) > 0n && !this.utxoProcessorManagerPendingUtxoPromise) {
            this.utxoProcessorManagerPendingUtxoPromise = new Promise((resolve) => {
              this.utxoProcessorManagerPendingUtxoResolve = resolve;
            })
          } 
          
          if ((balanceData.outgoing) == 0n && this.utxoProcessorManagerPendingUtxoPromise) {
            this.utxoProcessorManagerPendingUtxoResolve?.();
            this.utxoProcessorManagerPendingUtxoPromise = undefined;
            this.utxoProcessorManagerPendingUtxoResolve = undefined;

          }
        }
      })
    }
  }

  async stopListiningToWalletActions() {
    await this.utxoProcessorManager?.dispose();
    await this.mempoolTransactionsManager?.dispose();
    this.currentMempoolManagerTransactionSignalSubscription?.unsubscribe();
    this.currentUtxoProcessorManagerTransactionSignalSubscription?.unsubscribe();
    this.utxoProcessorManager = undefined;
    this.mempoolTransactionsManager = undefined;
    this.isSettingUtxoProcessorManager = false;
    this.walletStateBalance.set(undefined);
    this.mempoolTransactionsSignal.set(undefined);
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

  refreshUtxosBalance() {
    this.kaspaNetworkActionsService
      .getWalletBalanceAndUtxos(this.getAddress())
      .then((value) => this.balanceSignal.set(value))
      .catch(() => {
        console.error('Failed to load balance for wallet ' + this.getAddress());
      });
  }

  // This is keeps updating
  getWalletUtxoStateBalanceSignal(): Signal<undefined | BalanceData> {
    return this.walletStateBalance.asReadonly();
  }

  // This is keeps updating, the other one is just to show on the select wallet page
  getCurrentWalletStateBalanceSignalValue(): BalanceData | undefined {
    return this.getWalletUtxoStateBalanceSignal()();
  }

  getMempoolTransactionsSignal(): Signal<IMempoolResultEntry | undefined> {
    return this.mempoolTransactionsSignal.asReadonly();
  }

  getMempoolTransactionsSignalValue(): IMempoolResultEntry | undefined {
    return this.getMempoolTransactionsSignal()();
  }

  supportAccounts(): boolean {
    return !!this.version;
  }

  async waitForWalletToBeReadyForTransactions(): Promise<void> {
    await this.mempoolTransactionsManagerPendingPromise;
    await this.utxoProcessorManagerPendingUtxoPromise;
  }

  getKasplexL2ServiceWallet() {
    return this.kasplexL2Service.getChainWallet(this.getPrivateKey().toString());
  }

  getKasplexL2ServiceWalletAddressSignal(): Signal<string | undefined> {
    return this.kasplexL2ServiceWalletAddress.asReadonly();
  }

  async getKasplexL2ServiceBalance(): Promise<bigint> {
    return await this.kasplexL2Service.getWalletBalance(await this.getKasplexL2ServiceWallet().getAddress());
  }
}
