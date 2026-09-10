import {
  EnvironmentInjector,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { PrivateKey } from '../../../public/kaspa/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-netwrok-services/kaspa-network-actions.service';
import {
  SavedWalletAccount,
  SavedWalletData,
} from '../types/saved-wallet-data';
import { TotalBalanceWithUtxosInterface } from '../types/kaspa-network/total-balance-with-utxos.interface';
import { UtxoProcessorManager } from './UtxoProcessorManager';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { BalanceData } from '../types/kaspa-network/balance-event.interface';
import { MempoolTransactionManager } from './MempoolTransactionManager';
import { IMempoolResultEntry } from '../types/kaspa-network/mempool-result.interface';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ethers } from 'ethers';
import { BaseEthereumProvider } from '../services/etherium-services/base-ethereum-provider';
import { EthereumWalletChainManager } from '../services/etherium-services/etherium-wallet-chain.manager';
import { KaspaWalletMnemonicActionsService } from '../services/kaspa-netwrok-services/kaspa-wallet-mnemonic-actions.service';
import { isMalformedKaspaRpcResponseError } from '../observability/kaspa-rpc-errors';
import {
  computeDegradedL2WalletState,
  computeFreshL2WalletState,
} from './l2-wallet-state';

export interface L2WalletState {
  chainId: number | undefined;
  address: string | undefined;
  balance: bigint;
  balanceFormatted: number;
  availability: 'fresh' | 'stale' | 'unavailable';
}

export class AppWallet {
  private id: number;
  private name: string;
  private hasMnemonic: boolean;
  private accountData: SavedWalletAccount | undefined;
  private privateKey: PrivateKey;
  private version: number | undefined = undefined;
  private balanceSignal: WritableSignal<
    undefined | TotalBalanceWithUtxosInterface
  > = signal(undefined);
  private utxoProcessorManager: UtxoProcessorManager | undefined = undefined;
  private mempoolTransactionsManager: MempoolTransactionManager | undefined =
    undefined;
  private isSettingUtxoProcessorManager = false;
  private walletStateBalance: WritableSignal<undefined | BalanceData> =
    signal(undefined);
  private mempoolTransactionsSignal: WritableSignal<
    IMempoolResultEntry | undefined
  > = signal(undefined);
  private isCurrentlyActiveSingal = signal(false);
  private l2WalletStateSignal: WritableSignal<L2WalletState | undefined> =
    signal(undefined);
  private currentMempoolManagerTransactionSignalSubscription:
    | undefined
    | Subscription = undefined;
  private currentUtxoProcessorManagerTransactionSignalSubscription:
    | undefined
    | Subscription = undefined;

  // Promises
  private utxoProcessorManagerPendingUtxoPromise: Promise<unknown> | undefined =
    undefined;
  private utxoProcessorManagerPendingUtxoResolve:
    | undefined
    | ((v?: any) => void) = undefined;
  private mempoolTransactionsManagerPendingPromise:
    | Promise<unknown>
    | undefined = undefined;
  private mempoolTransactionsManagerPendingResolve:
    | undefined
    | ((v?: any) => void) = undefined;

  private readonly kaspaNetworkActionsService: KaspaNetworkActionsService;
  private readonly kaspaWalletMnemonicActionsService: KaspaWalletMnemonicActionsService;
  private readonly ethereumWalletChainManager: EthereumWalletChainManager;

  constructor(
    savedWalletData: SavedWalletData,
    shoudLoadBalance: boolean,
    account: SavedWalletAccount | undefined,
    private readonly injector: EnvironmentInjector,
  ) {
    this.id = savedWalletData.id;
    this.name = savedWalletData.name;
    this.accountData = account;
    this.hasMnemonic = !!savedWalletData.mnemonic;
    this.version = savedWalletData.version;
    this.ethereumWalletChainManager = this.injector.get(
      EthereumWalletChainManager,
    );
    this.kaspaNetworkActionsService = this.injector.get(
      KaspaNetworkActionsService,
    );
    this.kaspaWalletMnemonicActionsService = this.injector.get(
      KaspaWalletMnemonicActionsService,
    )

    if (!savedWalletData.privateKey && !savedWalletData.mnemonic) {
      throw new Error('Wallet must have a private key or a mnemonic');
    }

    if (savedWalletData.privateKey) {
      this.privateKey = new PrivateKey(savedWalletData.privateKey);
    } else {
      const memonicPk =
        this.kaspaWalletMnemonicActionsService.getPrivateKeyFromMnemonic(
          savedWalletData.mnemonic!,
          account!.derivedPath,
          savedWalletData.password,
        );

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

    if (this.ethereumWalletChainManager.getCurrentChainSignal()()) {
      void this.updateL2WalletState();
    }

    toObservable(this.ethereumWalletChainManager.getCurrentChainSignal(), {
      injector: this.injector,
    }).subscribe((chain) => {
      void this.updateL2WalletState();
    });
  }

  getId(): number {
    return this.id;
  }

  getIdWithAccount(): string {
    return `${this.id}-${this.accountData ? this.accountData.derivedPath : 'no-account'}`;
  }

  getDisplayName(): string {
    return this.accountData?.name
      ? `${this.name} (${this.accountData.name})`
      : this.name;
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

  setAccountName(name: string) {
    if (this.accountData) {
      this.accountData.name = name;
    }
  }

  getPrivateKey(): PrivateKey {
    return this.privateKey;
  }

  getAddress(): string {
    return this.kaspaNetworkActionsService.convertPrivateKeyToAddress(
      this.privateKey.toString(),
    );
  }

  getTotalBalanceAsSignal(): number | undefined {
    return this.balanceSignal() === undefined
      ? undefined
      : this.kaspaNetworkActionsService.sompiToNumber(
        this.balanceSignal()!.totalBalance,
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
      try {
        this.mempoolTransactionsManager =
          await this.kaspaNetworkActionsService.initMempoolTransactionManager(
            this.getAddress(),
          );
      } catch (error) {
        if (!isMalformedKaspaRpcResponseError(error)) {
          throw error;
        }
        console.warn('Failed to initialize wallet mempool monitoring', error);
        return;
      }
      this.currentMempoolManagerTransactionSignalSubscription = toObservable(
        this.mempoolTransactionsManager.getWalletMempoolTransactionsSignal(),
        { injector: this.injector },
      ).subscribe((mempoolTransactionData) => {
        this.mempoolTransactionsSignal.set(mempoolTransactionData);

        if (mempoolTransactionData) {
          if (
            mempoolTransactionData.sending.length > 0 &&
            !this.mempoolTransactionsManagerPendingPromise
          ) {
            this.mempoolTransactionsManagerPendingPromise = new Promise(
              (resolve) => {
                this.mempoolTransactionsManagerPendingResolve = resolve;
              },
            );
          }

          if (
            mempoolTransactionData.sending.length == 0 &&
            this.mempoolTransactionsManagerPendingPromise
          ) {
            this.mempoolTransactionsManagerPendingResolve?.();
            this.mempoolTransactionsManagerPendingPromise = undefined;
            this.mempoolTransactionsManagerPendingResolve = undefined;
          }
        }
      });
    }

    if (!this.isSettingUtxoProcessorManager) {
      this.isSettingUtxoProcessorManager = true;
      try {
        this.utxoProcessorManager =
          await this.kaspaNetworkActionsService.initUtxoProcessorManager(
            this.getAddress(),
          );
      } catch (error) {
        this.isSettingUtxoProcessorManager = false;
        if (!isMalformedKaspaRpcResponseError(error)) {
          throw error;
        }
        console.warn('Failed to initialize wallet UTXO monitoring', error);
        return;
      }

      this.currentUtxoProcessorManagerTransactionSignalSubscription =
        toObservable(this.utxoProcessorManager.getUtxoBalanceStateSignal(), {
          injector: this.injector,
        }).subscribe((balanceData) => {
          this.walletStateBalance.set(balanceData);
          this.refreshUtxosBalance();
          if (
            this.getCurrentWalletStateBalanceSignalValue() &&
            (this.getCurrentWalletStateBalanceSignalValue()!.outgoing > 0n ||
              this.getCurrentWalletStateBalanceSignalValue()!.pending > 0n)
          ) {
            this.mempoolTransactionsManager?.refreshMempoolTransactionsInBackground();
          }

          if (balanceData) {
            if (
              balanceData.outgoing > 0n &&
              !this.utxoProcessorManagerPendingUtxoPromise
            ) {
              this.utxoProcessorManagerPendingUtxoPromise = new Promise(
                (resolve) => {
                  this.utxoProcessorManagerPendingUtxoResolve = resolve;
                },
              );
            }

            if (
              balanceData.outgoing == 0n &&
              this.utxoProcessorManagerPendingUtxoPromise
            ) {
              this.utxoProcessorManagerPendingUtxoResolve?.();
              this.utxoProcessorManagerPendingUtxoPromise = undefined;
              this.utxoProcessorManagerPendingUtxoResolve = undefined;
            }
          }
        });
    }
  }

  async stopListiningToWalletActions() {
    // Releasing resources must not be abandoned half-way: a rejection here
    // would leave subscriptions and managers attached for the next switch.
    try {
      await this.utxoProcessorManager?.dispose();
    } catch (error) {
      console.warn('Failed to dispose wallet UTXO monitoring', error);
    }
    try {
      await this.mempoolTransactionsManager?.dispose();
    } catch (error) {
      console.warn('Failed to dispose wallet mempool monitoring', error);
    }
    this.currentMempoolManagerTransactionSignalSubscription?.unsubscribe();
    this.currentUtxoProcessorManagerTransactionSignalSubscription?.unsubscribe();
    this.utxoProcessorManager = undefined;
    this.mempoolTransactionsManager = undefined;
    this.isSettingUtxoProcessorManager = false;
    this.walletStateBalance.set(undefined);
    this.mempoolTransactionsSignal.set(undefined);
  }

  resetL1NetworkState(): void {
    this.balanceSignal.set(undefined);
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

  async refreshUtxosBalance(): Promise<void> {
    try {
      const value = await this.kaspaNetworkActionsService.getWalletBalanceAndUtxos(
        this.getAddress(),
      );
      this.balanceSignal.set(value);
    } catch (error) {
      console.error('Failed to load balance for wallet ' + this.getAddress(), error);
    }
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

  getL2WalletAddress(): string {
    const wallet = new ethers.Wallet(this.getPrivateKey().toString());
    return wallet.address;
  }

  private async updateL2WalletState() {
    if (this.ethereumWalletChainManager.getCurrentChainSignal()()) {
      if (
        Number(this.ethereumWalletChainManager.getCurrentChainSignal()()) !=
        this.l2WalletStateSignal()?.chainId
      ) {
        this.l2WalletStateSignal.set(undefined);
      }

      const chainId = Number(
        this.ethereumWalletChainManager.getCurrentChainSignal()(),
      );
      try {
        const address = await this.getL2WalletAddress();
        const balance = await this.getL2Balance();
        const nativeCurrencyDecimals =
          this.getL2Provider()!.getConfig().nativeCurrency.decimals;

        this.l2WalletStateSignal.set(
          computeFreshL2WalletState(chainId, {
            address,
            balance,
            nativeCurrencyDecimals,
          }),
        );
      } catch (error) {
        console.warn('L2 balance is temporarily unavailable', error);
        this.l2WalletStateSignal.set(
          computeDegradedL2WalletState(chainId, this.l2WalletStateSignal()),
        );
      }
    } else {
      this.l2WalletStateSignal.set(undefined);
    }
  }

  async getL2Wallet(): Promise<ethers.Wallet | undefined> {
    return this.ethereumWalletChainManager
      .getCurrentWalletProvider()
      ?.getChainWallet(this.getPrivateKey().toString());
  }

  getL2Provider(): BaseEthereumProvider | undefined {
    return this.ethereumWalletChainManager.getCurrentWalletProvider();
  }

  getL2WalletStateSignal(): Signal<L2WalletState | undefined> {
    return this.l2WalletStateSignal.asReadonly();
  }

  /**
   * Refresh the L2 wallet balance - call this after L2 transactions
   */
  async refreshL2Balance(): Promise<void> {
    await this.updateL2WalletState();
  }

  private async getL2Balance(): Promise<bigint> {
    const l2Address = this.getL2WalletAddress();

    if (!l2Address) {
      return 0n;
    }

    const balance = await this.ethereumWalletChainManager
      .getCurrentWalletProvider()!
      .getWalletBalance(l2Address);

    return balance;
  }

  isHasMnemonic(): boolean {
    return this.hasMnemonic;
  }
}
