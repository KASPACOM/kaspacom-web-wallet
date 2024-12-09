import {
  effect,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { PasswordManagerService } from './password-manager.service';
import { SavedWalletData } from '../types/saved-wallet-data';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import * as _ from 'lodash';
import { AppWallet } from '../classes/AppWallet';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { AssetType, TransferableAsset } from '../types/transferable-asset';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';
import { UtilsHelper } from './utils.service';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private currentWalletSignal = signal<AppWallet | undefined>(undefined);
  private allWalletsSignal = signal<AppWallet[] | undefined>(undefined);

  constructor(
    private readonly passwordManagerService: PasswordManagerService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly kasplexService: KasplexKrc20Service,
    private readonly utilsService: UtilsHelper
  ) {}

  async addWalletFromPrivateKey(
    name: string,
    privateKey: string,
    mnemonic?: string,
    derivedPath?: string
  ): Promise<{ sucess: boolean; error?: string }> {
    const isValid =
      this.kaspaNetworkActionsService.validatePrivateKey(privateKey);

    if (!isValid) {
      return {
        sucess: false,
        error: 'Invalid private key',
      };
    }

    const currentWalletsData = await this.passwordManagerService.getUserData();

    if (
      currentWalletsData.wallets.find(
        (wallet) => wallet.privateKey === privateKey
      )
    ) {
      return {
        sucess: false,
        error: 'Wallet already exists',
      };
    }

    const id = currentWalletsData.wallets.length + 1;
    const result = await this.addWalletData({
      id,
      name,
      privateKey,
      mnemonic,
      derivedPath,
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
    derivedPath?: string,
    passphrase?: string
  ): Promise<{ sucess: boolean; error?: string }> {
    const privateKey =
      await this.kaspaNetworkActionsService.getPrivateKeyFromMnemonic(
        mnemonic,
        derivedPath,
        passphrase
      );

    if (!privateKey) {
      return {
        sucess: false,
        error: 'Invalid mnemonic',
      };
    }

    return await this.addWalletFromPrivateKey(
      name,
      privateKey,
      mnemonic,
      derivedPath
    );
  }

  async deleteWallet(walletId: number): Promise<boolean> {
    const appWallet = this.getWalletById(walletId);

    if (appWallet?.isCurrentlyActive()) {
      return false;
    }

    const walletsData = await this.passwordManagerService.getUserData();
    const wallets = walletsData.wallets.filter(
      (wallet) => wallet.id !== walletId
    );
    walletsData.wallets = wallets;
    const result =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData
      );

    this.allWalletsSignal.update((oldValue) => {
      return oldValue?.filter((wallet) => wallet.getId() !== walletId) || [];
    });

    return result;
  }

  generateMnemonic(wordsCount: number = 12): string {
    return this.kaspaNetworkActionsService.generateMnemonic(wordsCount);
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string
  ): string | null {
    return this.kaspaNetworkActionsService.getWalletAddressFromMnemonic(
      mnemonic,
      password
    );
  }

  private async addWalletData(walletData: SavedWalletData): Promise<boolean> {
    const walletsData = await this.passwordManagerService.getUserData();
    walletsData.wallets.push(walletData);

    const result =
      await this.passwordManagerService.saveWalletsDataWithStoredPassword(
        walletsData
      );

    this.allWalletsSignal.update((oldValue) => [
      ...(oldValue || []),
      new AppWallet(walletData, true, this.kaspaNetworkActionsService),
    ]);

    return result;
  }

  getWalletsCount(): number {
    return this.allWalletsSignal()?.length || 0;
  }

  async loadWallets(loadBalance: boolean = false): Promise<void> {
    const walletsData = await this.passwordManagerService.getUserData();
    this.allWalletsSignal.set(
      walletsData.wallets.map(
        (wallet) =>
          new AppWallet(wallet, loadBalance, this.kaspaNetworkActionsService)
      )
    );
  }

  getAllWallets(loadBalance: boolean = false): Signal<AppWallet[] | undefined> {
    if (loadBalance) {
      this.allWalletsSignal()?.forEach((wallet) => {
        wallet.refreshBalance();
      });
    }

    return this.allWalletsSignal.asReadonly();
  }

  getAllWalletsById(): { [id: number]: AppWallet } | undefined {
    const wallets = this.getAllWallets()();
    return wallets?.reduce((obj, wallet) => {
      obj[wallet.getId()] = wallet;
      return obj;
    }, {} as { [key: number]: AppWallet });
  }

  getWalletById(
    id: number,
    loadBalance: boolean = false
  ): AppWallet | undefined {
    const wallet = this.getAllWalletsById()?.[id];

    if (wallet && loadBalance) {
      wallet.refreshBalance();
    }

    return wallet;
  }

  async selectCurrentWalletFromLocalStoage(): Promise<void> {
    const walletId = localStorage.getItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET
    );
    await this.selectCurrentWallet(Number(walletId), true);
  }

  selectCurrentWallet(
    walletId: number,
    skipLocalStorage: boolean = false
  ): AppWallet | undefined {
    if (walletId == this.currentWalletSignal()?.getId()) {
      return this.currentWalletSignal();
    }

    if (this.currentWalletSignal()) {
      this.deselectCurrentWallet();
    }

    this.currentWalletSignal.set(this.getWalletById(walletId, true));

    if (!this.currentWalletSignal()) {
      return undefined;
    }

    localStorage.setItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET,
      walletId.toString()
    );

    if (
      this.kaspaNetworkActionsService.getConnectionStatusSignal()() ==
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

  async getAllAvailableAssetsForCurrentWallet(): Promise<TransferableAsset[]> {
    if (!this.getCurrentWallet()) {
      return [];
    }
    const krc20tokens = await firstValueFrom(
      this.kasplexService.getWalletTokenList(
        this.getCurrentWallet()!.getAddress()
      )
    );

    return [
      {
        ticker: 'TKAS',
        type: AssetType.KAS,
        availableAmount:
          this.getCurrentWallet()?.getWalletUtxoStateBalanceSignal()()
            ?.mature || 0n,
        name: 'TKAS',
      },
    ].concat(
      krc20tokens.result.map((token) => ({
        ticker: token.tick,
        type: AssetType.KRC20,
        availableAmount: BigInt(token.balance),
        name: token.tick,
      }))
    );
  }

  async updateWalletName(wallet: AppWallet, newName: string): Promise<boolean> {
    if (this.utilsService.isNullOrEmptyString(newName)) {
      return false;
    }
    const walletsData = await this.passwordManagerService.getUserData();

    const walletData = walletsData.wallets.find((w) => w.id === wallet.getId());

    if (walletData) {
      walletData.name = newName;
    } else {
      return false;
    }

    return await this.passwordManagerService.saveWalletsDataWithStoredPassword(
      walletsData
    );
  }
}
