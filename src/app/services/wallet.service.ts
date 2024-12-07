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
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { AssetType, TransferableAsset } from '../types/transferable-asset';
import { KasplexKrc20Service } from './kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';
import { UtilsHelper } from './utils.service';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private currentWallet: AppWallet | undefined = undefined;
  private allWalletsSignal = signal<AppWallet[] | undefined>(undefined);

  constructor(
    private readonly passwordManagerService: PasswordManagerService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly kasplexService: KasplexKrc20Service,
    private readonly utilsService: UtilsHelper
  ) {
    // On rpc status change
    effect(() => {
      if (
        this.kaspaNetworkActionsService.getConnectionStatusSignal()() ==
        RpcConnectionStatus.CONNECTED
      ) {
        if (this.currentWallet) {
          this.currentWallet.startListiningToWalletActions();
        }
      } else {
        if (this.currentWallet) {
          this.currentWallet.stopListiningToWalletActions();
        }
      }
    });
  }

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
    const walletsData = await this.passwordManagerService.getUserData();
    const wallets = walletsData.wallets.filter(
      (wallet) => wallet.id !== walletId
    );
    walletsData.wallets = wallets;
    return await this.passwordManagerService.saveWalletsDataWithStoredPassword(
      walletsData
    );
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

    return await this.passwordManagerService.saveWalletsDataWithStoredPassword(
      walletsData
    );
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
    if (this.currentWallet) {
      this.deselectCurrentWallet();
    }

    this.currentWallet = this.getWalletById(walletId, true);

    if (!this.currentWallet) {
      return undefined;
    }

    localStorage.setItem(
      LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET,
      walletId.toString()
    );

    this.currentWallet.startListiningToWalletActions();

    return this.currentWallet;
  }

  getCurrentWallet(): AppWallet | undefined {
    return this.currentWallet;
  }

  async deselectCurrentWallet(): Promise<void> {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET);
    await this.currentWallet?.stopListiningToWalletActions();
    this.currentWallet = undefined;
  }

  async getAllAvailableAssetsForCurrentWallet(): Promise<TransferableAsset[]> {
    if (!this.currentWallet) {
      return [];
    }
    const krc20tokens = await firstValueFrom(
      this.kasplexService.getWalletTokenList(this.currentWallet.getAddress())
    );

    return [
      {
        ticker: 'TKAS',
        type: AssetType.KAS,
        availableAmount:
          this.currentWallet.getWalletUtxoStateBalanceSignal()()?.mature || 0n,
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
