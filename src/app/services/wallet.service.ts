import { computed, EnvironmentInjector, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { PasswordManagerService } from './password-manager.service';
import { SavedWalletAccount, SavedWalletData, } from '../types/saved-wallet-data';
import { AppWallet } from '../classes/AppWallet';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { AssetType, TransferableAsset } from '../types/transferable-asset';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';
import { UtilsHelper } from './utils.service';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { cloneDeep } from "lodash";
import { EthereumWalletChainManager } from './etherium-services/etherium-wallet-chain.manager';
import { KaspaNetworkConnectionManagerService } from './kaspa-netwrok-services/kaspa-network-connection-manager.service';
import { KaspaWalletMnemonicActionsService } from './kaspa-netwrok-services/kaspa-wallet-mnemonic-actions.service';

export enum VIEW_METHOD {
  L1 = 'l1',
  L2 = 'l2',
}

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private currentWalletSignal = signal<AppWallet | undefined>(undefined);
  private allWalletsSignal = signal<AppWallet[] | undefined>(undefined);
  private isL2DisplaySignal: WritableSignal<boolean>;
  private isWalletLoaded = false;

  constructor(
    private readonly passwordManagerService: PasswordManagerService,
    private readonly kaspaWalletMnemonicActionsService: KaspaWalletMnemonicActionsService,
    private readonly kaspaConnectionManagerService: KaspaNetworkConnectionManagerService,
    private readonly kasplexService: KasplexKrc20Service,
    private readonly utilsService: UtilsHelper,
    private readonly injector: EnvironmentInjector,
    private readonly etheriumChainManager: EthereumWalletChainManager,
  ) {
    let isL2View = localStorage.getItem(LOCAL_STORAGE_KEYS.IS_L2_DISPLAY) === 'true';

    const urlParams = new URLSearchParams(window.location.search);
    const viewTypeParam = urlParams.get('view');
    if (viewTypeParam) {
      isL2View = viewTypeParam === VIEW_METHOD.L2;
    }

    this.isL2DisplaySignal = signal<boolean>(isL2View);
  }

  async addWallet(
    name: string,
    privateKey?: string,
    mnemonic?: string,
    passphrase?: string,
    accountData?: SavedWalletAccount,
  ): Promise<{ sucess: boolean; error?: string }> {
    if (!privateKey && !(mnemonic && accountData)) {
      return {
        sucess: false,
        error: 'Wallet must have a private key or a mnemonic',
      };
    }

    let mnemonicPk = undefined;

    if (!privateKey) {
      mnemonicPk =
        await this.kaspaWalletMnemonicActionsService.getPrivateKeyFromMnemonic(
          mnemonic!,
          accountData!.derivedPath,
          passphrase,
        );

      if (!mnemonicPk) {
        return {
          sucess: false,
          error: 'Invalid mnemonic',
        };
      }
    }

    const isValid = this.kaspaWalletMnemonicActionsService.validatePrivateKey(
      privateKey || mnemonicPk!,
    );

    if (!isValid) {
      return {
        sucess: false,
        error: 'Invalid private key',
      };
    }

    const currentWalletsData = await this.passwordManagerService.getUserData();

    if (
      currentWalletsData.wallets.find(
        (wallet) =>
          (wallet.privateKey && wallet.privateKey === privateKey) ||
          (mnemonic &&
            wallet.mnemonic === mnemonic &&
            wallet.password == passphrase),
      )
    ) {
      return {
        sucess: false,
        error: 'Wallet already exists',
      };
    }

    const id =
      Math.max(...currentWalletsData.wallets.map((wallet) => wallet.id), 0) + 1;
    const result = await this.saveWalletData({
      id,
      name,
      privateKey,
      mnemonic,
      password: passphrase,
      version: 1,
      accounts: accountData ? [accountData] : undefined,
    });

    if (result) {
      return { sucess: true };
    } else {
      return { sucess: false, error: 'Error adding wallet' };
    }
  }

  async addWalletFromMemonic(
    name: string,
    mnemonic: string,
    derivedPath: string,
    accountName: string,
    passphrase?: string,
  ): Promise<{ sucess: boolean; error?: string }> {
    return await this.addWallet(name, undefined, mnemonic, passphrase, {
      name: accountName,
      derivedPath: derivedPath,
    });
  }

  async addWalletAccount(
    walletId: number,
    derivedPath: string,
    name: string,
  ): Promise<{ success: boolean; error?: string }> {
    const walletsData = await this.passwordManagerService.getUserData();

    const walletAccountData: SavedWalletAccount = {
      name,
      derivedPath,
    };

    const walletData = walletsData.wallets.find((w) => w.id === walletId);

    if (walletData) {
      if (!walletData.version) {
        return {
          success: false,
          error: "Old wallet, can't add accounts",
        };
      }
      walletData.accounts!.push(walletAccountData);
    } else {
      return {
        success: false,
        error: 'Wallet not found',
      };
    }

    const success =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData,
      );

    if (!success) {
      return {
        success: false,
        error: 'Error adding wallet account',
      };
    }

    this.allWalletsSignal.update((oldValue) => [
      ...(oldValue || []),
      this.createAppWalletFromSavedWalletData(
        walletData,
        true,
        walletAccountData,
      ),
    ]);

    return {
      success: true,
    };
  }

  async removeWalletAccount(
    walletIdAndAccount: string,
  ): Promise<{ success: boolean; error?: string }> {
    const appWallet = this.getWalletByIdAndAccount(walletIdAndAccount);

    if (!appWallet) {
      return {
        success: false,
        error: 'Wallet not found',
      };
    }

    if (appWallet?.isCurrentlyActive()) {
      return {
        success: false,
        error: 'Wallet is currently active',
      };
    }

    const walletsData = await this.passwordManagerService.getUserData();

    const walletData = walletsData.wallets.find(
      (w) => w.id === appWallet.getId(),
    );

    if (walletData) {
      if (!walletData.version || !walletData.accounts?.length) {
        return {
          success: false,
          error: "Old wallet, can't delete accounts",
        };
      }

      walletData.accounts = walletData.accounts!.filter(
        (wa) => wa.derivedPath !== appWallet.getDerivedPath(),
      );
    } else {
      return {
        success: false,
        error: 'Wallet not found',
      };
    }

    const success =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData,
      );

    if (!success) {
      return {
        success: false,
        error: 'Error adding wallet account',
      };
    }

    this.allWalletsSignal.update((oldValue) => {
      return (
        oldValue?.filter(
          (wallet) =>
            !(
              wallet.getId() == appWallet.getId() &&
              wallet.getDerivedPath() == appWallet.getDerivedPath()
            ),
        ) || []
      );
    });
    return {
      success: true,
    };
  }

  async deleteWallet(walletIdAndAccount: string): Promise<boolean> {
    const appWallet = this.getWalletByIdAndAccount(walletIdAndAccount);

    if (!appWallet) {
      return false;
    }

    if (appWallet?.isCurrentlyActive()) {
      return false;
    }

    const walletsData = await this.passwordManagerService.getUserData();
    const wallets = walletsData.wallets.filter(
      (wallet) => wallet.id !== appWallet.getId(),
    );
    walletsData.wallets = wallets;
    const result =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData,
      );

    this.allWalletsSignal.update((oldValue) => {
      return (
        oldValue?.filter((wallet) => wallet.getId() !== appWallet.getId()) || []
      );
    });

    return result;
  }

  generateMnemonic(wordsCount: number = 12): string {
    return this.kaspaWalletMnemonicActionsService.generateMnemonic(wordsCount);
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string,
  ): string | null {
    return this.kaspaWalletMnemonicActionsService.getWalletAddressFromMnemonic(
      mnemonic,
      password,
    );
  }

  private async saveWalletData(walletData: SavedWalletData): Promise<boolean> {
    const walletsData = await this.passwordManagerService.getUserData();
    walletsData.wallets.push(walletData);

    const result =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData,
      );

    this.allWalletsSignal.update((oldValue) => [
      ...(oldValue || []),
      this.createAppWalletFromSavedWalletData(
        walletData,
        true,
        walletData.accounts?.[0],
      ),
    ]);

    return result;
  }

  getWalletsCount(): number {
    return this.allWalletsSignal()?.length || 0;
  }

  async loadWallets(loadBalance: boolean = false): Promise<void> {
    // If wallets are already loaded, don't reload them to prevent state corruption
    if (this.isWalletLoaded) {
      console.warn('loadWallets() called but wallets are already loaded. Ignoring to prevent state corruption.');
      return;
    }

    await this.forceReloadWallets(loadBalance);
  }

  /**
   * Force reload wallets from storage - use sparingly and only when necessary
   * This should only be used during onboarding when new wallets are created
   */
  async forceReloadWallets(loadBalance: boolean = false): Promise<void> {
    this.isWalletLoaded = true;

    const walletsData = await this.passwordManagerService.getUserData();

    const allWallets = [];

    for (const wallet of walletsData.wallets) {
      if (wallet.accounts && wallet.accounts.length) {
        for (const walletAccount of wallet.accounts) {
          allWallets.push(
            this.createAppWalletFromSavedWalletData(
              wallet,
              loadBalance,
              walletAccount,
            ),
          );
        }
      } else {
        allWallets.push(
          this.createAppWalletFromSavedWalletData(
            wallet,
            loadBalance,
            undefined,
          ),
        );
      }
    }

    this.allWalletsSignal.set(allWallets);
  }

  /**
   * Reset the wallet loading state - only for testing or emergency situations
   */
  resetWalletLoadingState(): void {
    this.isWalletLoaded = false;
    this.allWalletsSignal.set(undefined);
    this.currentWalletSignal.set(undefined);
  }

  getAllWallets(loadBalance: boolean = false): Signal<AppWallet[] | undefined> {
    if (loadBalance) {
      this.allWalletsSignal()?.forEach((wallet) => {
        wallet.refreshUtxosBalance();
      });
    }

    return this.allWalletsSignal.asReadonly();
  }

  getAllWalletsByIdAndAccount(): { [id: string]: AppWallet } | undefined {
    const wallets = this.getAllWallets()();
    return wallets?.reduce(
      (obj, wallet) => {
        obj[wallet.getIdWithAccount()] = wallet;
        return obj;
      },
      {} as { [key: string]: AppWallet },
    );
  }

  getAllWalletsById(): { [id: number]: AppWallet } | undefined {
    const wallets = this.getAllWallets()();
    return wallets?.reduce(
      (obj, wallet) => {
        obj[wallet.getId()] = wallet;
        return obj;
      },
      {} as { [key: number]: AppWallet },
    );
  }

  getWalletById(
    id: number,
    loadBalance: boolean = false,
  ): AppWallet | undefined {
    const wallet = this.getAllWalletsByIdAndAccount()?.[id];

    if (wallet && loadBalance) {
      wallet.refreshUtxosBalance();
    }

    return wallet;
  }

  getWalletByIdAndAccount(
    idWithAccount: string,
    loadBalance: boolean = false,
  ): AppWallet | undefined {
    const wallet = this.getAllWalletsByIdAndAccount()?.[idWithAccount];

    if (wallet && loadBalance) {
      wallet.refreshUtxosBalance();
    }

    return wallet;
  }

  async selectCurrentWalletFromLocalStorageNullsafe(): Promise<void> {
    let walletIdWithAccount = localStorage.getItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET,
    );
    if (!walletIdWithAccount) {
      const allWallets = this.getAllWallets();
      if (!allWallets) {
        return;
      }
      const len = allWallets()?.length || 0;
      if (len > 0) {
        walletIdWithAccount = allWallets()![0].getIdWithAccount();
      }
    }
    this.selectCurrentWallet(walletIdWithAccount!);
  }

  async selectCurrentWalletFromLocalStorage(): Promise<void> {
    const walletIdWithAccount = localStorage.getItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET,
    );
    await this.selectCurrentWallet(walletIdWithAccount!);
  }

  selectCurrentWallet(walletIdWithAccount: string): AppWallet | undefined {
    if (walletIdWithAccount == this.currentWalletSignal()?.getIdWithAccount()) {
      return this.currentWalletSignal();
    }

    if (this.currentWalletSignal()) {
      this.deselectCurrentWallet();
    }

    this.currentWalletSignal.set(
      this.getWalletByIdAndAccount(walletIdWithAccount, true),
    );

    if (!this.currentWalletSignal()) {
      return undefined;
    }

    localStorage.setItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET,
      walletIdWithAccount,
    );

    if (
      this.kaspaConnectionManagerService.getConnectionStatusSignal()() ==
      RpcConnectionStatus.CONNECTED
    ) {
      this.getCurrentWallet()?.startListiningToWalletActions();
    }

    return this.currentWalletSignal();
  }

  getCurrentWallet(): AppWallet | undefined {
    return this.currentWalletSignal();
  }

  getCurrentWalletSignal(): Signal<AppWallet | undefined> {
    return this.currentWalletSignal.asReadonly();
  }

  async deselectCurrentWallet(): Promise<void> {
    if (this.currentWalletSignal()) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET);

      if (!this.currentWalletSignal()?.isCurrentlyActive()) {
        this.currentWalletSignal()?.stopListiningToWalletActions();
      }

      this.currentWalletSignal.set(undefined);
    }
  }

  async logout(): Promise<void> {
    this.passwordManagerService.clearPassword();
    await this.deselectCurrentWallet();
    this.isWalletLoaded = false;
  }

  async getAllAvailableAssetsForCurrentWallet(): Promise<TransferableAsset[]> {
    if (!this.getCurrentWallet()) {
      return [];
    }

    let additionalAssets: TransferableAsset[] = [];

    try {
      const krc20Assets = await this.getKrc20AvailableAssetsForCurrentWallet();
      additionalAssets = [...additionalAssets, ...krc20Assets];
    } catch (error) {
      console.error(error);
    }

    return [
      {
        ticker: 'TKAS',
        type: AssetType.KAS,
        availableAmount:
          this.getCurrentWallet()?.getCurrentWalletStateBalanceSignalValue()
            ?.mature || 0n,
        name: 'TKAS',
      },
      ...additionalAssets,
    ];
  }

  async getKrc20AvailableAssetsForCurrentWallet(): Promise<
    TransferableAsset[]
  > {
    const krc20tokens = await firstValueFrom(
      this.kasplexService.getWalletTokenList(
        this.getCurrentWallet()!.getAddress(),
      ),
    );

    return krc20tokens.result.map((token) => ({
      ticker: token.tick,
      type: AssetType.KRC20,
      availableAmount: BigInt(token.balance),
      name: token.tick,
    }));
  }

  async updateWalletName(wallet: AppWallet, newName: string): Promise<boolean> {
    if (this.utilsService.isNullOrEmptyString(newName)) {
      return false;
    }
    const walletsData = await this.passwordManagerService.getUserData();

    const walletData = walletsData.wallets.find((w) => w.id === wallet.getId());

    if (walletData) {
      walletData.name = newName;

      // Update current wallet signal if this is the current wallet
      const currentWallet = this.currentWalletSignal();
      if (currentWallet && walletData.id === currentWallet.getId()) {
        currentWallet?.setName(walletData.name);
        this.currentWalletSignal.set(cloneDeep(currentWallet));
      }

      // Update all wallet instances in allWalletsSignal
      this.allWalletsSignal.update((wallets) => {
        if (!wallets) return wallets;
        return wallets.map(w => {
          if (w.getId() === walletData.id) {
            w.setName(walletData.name);
            return cloneDeep(w);
          }
          return w;
        });
      });
    } else {
      return false;
    }

    return await this.passwordManagerService.saveWalletsDataWithStoredPassword(
      walletsData,
    );
  }

  async updateWalletAccountName(
    wallet: AppWallet,
    newName: string,
  ): Promise<boolean> {
    if (this.utilsService.isNullOrEmptyString(newName)) {
      return false;
    }

    const walletsData = await this.passwordManagerService.getUserData();
    const walletData = walletsData.wallets.find((w) => w.id === wallet.getId());

    if (!walletData?.accounts?.length) {
      return false;
    }

    const accountData = walletData.accounts.find(
      (account) => account.derivedPath === wallet.getDerivedPath(),
    );

    if (!accountData) {
      return false;
    }

    accountData.name = newName;

    const currentWallet = this.currentWalletSignal();
    if (
      currentWallet &&
      currentWallet.getIdWithAccount() === wallet.getIdWithAccount()
    ) {
      currentWallet.setAccountName(newName);
      this.currentWalletSignal.set(cloneDeep(currentWallet));
    }

    this.allWalletsSignal.update((wallets) => {
      if (!wallets) {
        return wallets;
      }

      return wallets.map((existingWallet) => {
        if (
          existingWallet.getId() === wallet.getId() &&
          existingWallet.getDerivedPath() === wallet.getDerivedPath()
        ) {
          existingWallet.setAccountName(newName);
          return cloneDeep(existingWallet);
        }

        return existingWallet;
      });
    });

    return await this.passwordManagerService.saveWalletsDataWithStoredPassword(
      walletsData,
    );
  }

  getWalletAccountNumberFromDerivedPath(derivedPath: string): number {
    const lastAccount = derivedPath.split('/').pop();
    const accountNumber = Number(lastAccount);

    if (isNaN(accountNumber)) {
      throw new Error('Invalid derived path');
    }

    return accountNumber;
  }

  replaceWalletAccountNumberFromDerivedPath(
    derivedPath: string,
    newAccountNumber: number,
  ): string {
    const pathComponents = derivedPath.split('/');
    pathComponents.pop();
    pathComponents.push(newAccountNumber.toString());

    return pathComponents.join('/');
  }

  private createAppWalletFromSavedWalletData(
    savedWalletData: SavedWalletData,
    shoudLoadBalance: boolean,
    account: SavedWalletAccount | undefined,
  ): AppWallet {
    return new AppWallet(
      savedWalletData,
      shoudLoadBalance,
      account,
      this.injector,
    );
  }


  setL2Display(value: boolean) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.IS_L2_DISPLAY, value.toString());
    this.isL2DisplaySignal.set(value);
  }

  isL2Display(): boolean {
    return this.isL2DisplaySignal();
  }

  getIsL2DisplaySignal(): Signal<boolean> {
    return this.isL2DisplaySignal.asReadonly();
  }

  getCurrentDisplayNativeTokenName(): string {
    if (this.isL2DisplaySignal()) {
      return this.etheriumChainManager.getCurrentWalletProvider()?.getConfig().nativeCurrency.symbol || 'KAS';
    } else {
      return 'KAS';
    }
  }

  public getCurrentDisplayWalletAddress = computed(() => {
    if (this.isL2DisplaySignal()) {
      const l2WalletAddress = this.currentWalletSignal()?.getL2WalletStateSignal()()?.address;

      return l2WalletAddress;
    }

    return this.currentWalletSignal()?.getAddress();
  });

  public getCurrentDisplayWalletAddressAsString = computed(() => {
    return this.getCurrentDisplayWalletAddress() || '';
  })

}
