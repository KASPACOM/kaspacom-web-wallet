import { Injectable, signal } from '@angular/core';
import { INewWallet } from '../interface/new-wallet.interface';

@Injectable({
  providedIn: 'root',
})
export class NewWalletFlowService {
  private _newWallet = signal<INewWallet>({
    password: '',
    confirmPassword: '',
    seedPhrase: '',
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
      seedPhrase: '',
    });
  }

  submitPasswordStep(password: string, confirmPassword: string) {
    this._newWallet.set({ ...this._newWallet(), password, confirmPassword });
    this.printState();
  }

  submitSeedPhraseStep(seedPhrase: string) {
    this._newWallet.set({ ...this._newWallet(), seedPhrase });
    this.printState();
  }
}
