import { Injectable } from '@angular/core';
import { PasswordManagerService } from './password-manager.service';
import { SavedWalletData } from '../types/saved-wallet-data';
import { WalletWithBalanceInfo } from '../types/wallet-with-balance-info';
import { PrivateKey } from '../../../public/kaspa/kaspa';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  constructor(
    private readonly passwordManagerService: PasswordManagerService
  ) {}

  async addWalletPrivateKey(
    name: string,
    privateKey: string
  ): Promise<boolean> {
    return await this.addWalletData({ name, privateKey });
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

  async getAllWalletsWithBalances(): Promise<WalletWithBalanceInfo[]> {
    const wallets = (await this.passwordManagerService.getWalletsData())
      .wallets;

    const walletsWithBalances: WalletWithBalanceInfo[] = [];

    for (const wallet of wallets) {
      const address = await this.convertPrivateKeyToAddress(wallet.privateKey);
      walletsWithBalances.push({ name: wallet.name, address, balance: 0 });
    }

    return walletsWithBalances;
  }

  private convertPrivateKeyToAddress(privateKey: string): string {
    return new PrivateKey(privateKey).toPublicKey().toAddress('testnet-10').toString();
  }
}
