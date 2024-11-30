import { Injectable, signal, WritableSignal } from '@angular/core';
import { PasswordManagerService } from './password-manager.service';
import { SavedWalletData } from '../types/saved-wallet-data';
import { WalletWithBalanceInfo } from '../types/wallet-with-balance-info';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import * as _ from 'lodash';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  constructor(
    private readonly passwordManagerService: PasswordManagerService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {}

  async addWalletPrivateKey(
    name: string,
    privateKey: string
  ): Promise<{ sucess: boolean; error?: string }> {
    const isValid =
      this.kaspaNetworkActionsService.validatePrivateKey(privateKey);

    if (!isValid) {
      return {
        sucess: false,
        error: 'Invalid private key',
      };
    }

    const currentWalletsData =
      await this.passwordManagerService.getWalletsData();

    if (currentWalletsData.wallets.find((wallet) => wallet.privateKey === privateKey)) {
      return {
        sucess: false,
        error: 'Wallet already exists',
      }
    }

    const id = currentWalletsData.wallets.length + 1;
    const result = await this.addWalletData({ id, name, privateKey });

    if (result) {
      return { sucess: true };
    } else {
      return { sucess: false, error: 'Error adding wallet' };
    }
  }

  private async addWalletData(walletData: SavedWalletData): Promise<boolean> {
    const walletsData = await this.passwordManagerService.getWalletsData();
    walletsData.wallets.push(walletData);

    return await this.passwordManagerService.saveWalletsData(walletsData);
  }

  async getWalletsCount(): Promise<number> {
    const walletsData = await this.passwordManagerService.getWalletsData();
    return walletsData.wallets.length;
  }

  async getAllWalletsWithBalancesAsSignal(): Promise<
    WritableSignal<{ [walletsAdress: string]: WalletWithBalanceInfo }>
  > {
    const wallets = (await this.passwordManagerService.getWalletsData())
      .wallets;

    const walletsWithBalances: WalletWithBalanceInfo[] = [];

    for (const wallet of wallets) {
      const address =
        await this.kaspaNetworkActionsService.convertPrivateKeyToAddress(
          wallet.privateKey
        );

      walletsWithBalances.push({
        id: wallet.id,
        name: wallet.name,
        address,
        balance: undefined,
      });
    }

    const walletsWithBalancesSignal: WritableSignal<{
      [walletsAdress: string]: WalletWithBalanceInfo;
    }> = signal(_.keyBy(walletsWithBalances, 'address'));

    for (const wallet of Object.keys(walletsWithBalancesSignal())) {
      this.kaspaNetworkActionsService
        .getWalletBalanceAndUtxos(wallet)
        .then((balanceData) => {
          walletsWithBalancesSignal.update((currentWallets) => ({
            ...currentWallets,
            [wallet]: {
              ...currentWallets[wallet],
              balance: this.kaspaNetworkActionsService.sompiToNumber(
                balanceData.totalBalance
              ),
            },
          }));
        })
        .catch((error) => {
          console.error(error);
        });
    }

    return walletsWithBalancesSignal;
  }
}
