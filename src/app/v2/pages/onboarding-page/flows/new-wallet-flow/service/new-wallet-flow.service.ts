import { Injectable, inject, signal } from '@angular/core';
import { INewWallet } from '../interface/new-wallet.interface';
import { WalletService } from '../../../../../../services/wallet.service';

@Injectable({
  providedIn: 'root',
})
export class NewWalletFlowService {
  private readonly walletService = inject(WalletService);

  private _newWallet = signal<INewWallet>({
    password: '',
    confirmPassword: '',
    seedPhraseWordCount: 12,
    seedPhrase: '',
    seedPhraseSaved: false,
    walletAddress: '',
  });

  get newWallet() {
    return this._newWallet;
  }

  printState() {
    console.log('New Wallet State:', this._newWallet());
  }

  initNewWallet() {
    this._newWallet.set({
      password: '',
      confirmPassword: '',
      seedPhraseWordCount: 12,
      seedPhrase: '',
      seedPhraseSaved: false,
      walletAddress: '',
    });
  }

  submitPasswordStep(password: string, confirmPassword: string) {
    this._newWallet.set({ ...this._newWallet(), password, confirmPassword });
    this.printState();
  }

  submitSeedPhraseStep(seedPhrase: string, seedPhraseWordCount: number) {
    const walletAddress = this.walletService.getWalletAddressFromMnemonic(
      seedPhrase,
      this._newWallet().password,
    );
    if (!walletAddress) {
      throw new Error('Failed to derive wallet address from seed phrase.');
    }
    this._newWallet.set({
      ...this._newWallet(),
      seedPhrase,
      seedPhraseWordCount,
      walletAddress,
    });
    this.printState();
  }

  submitSeedPhraseSaved(seedPhraseSaved: boolean) {
    this._newWallet.set({ ...this._newWallet(), seedPhraseSaved });
    this.printState();
  }
}
