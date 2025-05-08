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
import { EthereumWalletService } from '../services/ethereum-wallet.service';
import { ethers } from 'ethers';
import { BaseEthereumProvider } from '../services/base-ethereum-provider';

export interface L2WalletState {
  chainId: number | undefined;
  address: string | undefined;
  balance: bigint;
  balanceFormatted: number;
}

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
  private l2WalletStateSignal: WritableSignal<L2WalletState | undefined> = signal(undefined);
  private currentMempoolManagerTransactionSignalSubscription: undefined | Subscription = undefined;
  private currentUtxoProcessorManagerTransactionSignalSubscription: undefined | Subscription = undefined;


  // Promises
  private utxoProcessorManagerPendingUtxoPromise: Promise<unknown> | undefined = undefined;
  private utxoProcessorManagerPendingUtxoResolve: undefined | ((v?: any) => void) = undefined;
  private mempoolTransactionsManagerPendingPromise: Promise<unknown> | undefined = undefined;
  private mempoolTransactionsManagerPendingResolve: undefined | ((v?: any) => void) = undefined;

  private readonly kaspaNetworkActionsService: KaspaNetworkActionsService;
  private readonly ethereumWalletService: EthereumWalletService;

  constructor(
    savedWalletData: SavedWalletData,
    shoudLoadBalance: boolean,
    account: SavedWalletAccount | undefined,
    private readonly injector: EnvironmentInjector,
  ) {
    this.id = savedWalletData.id;
    this.name = savedWalletData.name;
    this.accountData = account;
    this.version = savedWalletData.version;
    this.ethereumWalletService = this.injector.get(EthereumWalletService);
    this.kaspaNetworkActionsService = this.injector.get(KaspaNetworkActionsService);

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

    if (this.ethereumWalletService.getCurrentChainSignal()()) {
      this.updateL2WalletState();
    }

    toObservable(this.ethereumWalletService.getCurrentChainSignal(), { injector: this.injector }).subscribe((chain) => {
      this.updateL2WalletState();
    });
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

  async getL2WalletAddress(): Promise<string | undefined> {
    return await this.ethereumWalletService.getCurrentWalletProvider()?.getChainWallet(this.getPrivateKey().toString()).getAddress();
  }

  private async updateL2WalletState() {
   if (this.ethereumWalletService.getCurrentChainSignal()()) {
    if (Number(this.ethereumWalletService.getCurrentChainSignal()()) != this.l2WalletStateSignal()?.chainId) {
      this.l2WalletStateSignal.set(undefined);
    }

    const chainId = Number(this.ethereumWalletService.getCurrentChainSignal()());
    const balance = await this.getL2Balance();

    this.l2WalletStateSignal.set({
      chainId,
      address: await this.getL2WalletAddress(),
      balance: balance,
      balanceFormatted: Number(balance) / (10 ** (this.getL2Provider()?.getConfig().nativeCurrency.decimals || 18)),
    });
   } else {
    this.l2WalletStateSignal.set(undefined);
   }
  }

  async getL2Wallet(): Promise<ethers.Wallet | undefined> {
    return this.ethereumWalletService.getCurrentWalletProvider()?.getChainWallet(this.getPrivateKey().toString());
  }

  getL2Provider(): BaseEthereumProvider | undefined {
    return this.ethereumWalletService.getCurrentWalletProvider();
  }

  getL2WalletStateSignal(): Signal<L2WalletState | undefined> {
    return this.l2WalletStateSignal.asReadonly();
  }

  private async getL2Balance(): Promise<bigint> {
    const l2Address = await this.getL2WalletAddress();

    if (!l2Address) {
      return 0n;
    }

    const balance = await this.ethereumWalletService.getCurrentWalletProvider()!.getWalletBalance(l2Address);

    return balance;
  }
}
