import { Injectable, signal } from '@angular/core';
import { INewWallet } from '../interface/new-wallet.interface';

@Injectable({
  providedIn: 'root',
})
export class NewWalletFlowService {
  private _newWallet = signal<INewWallet>({
    password: '',
    confirmPassword: '',
  });

  get newWallet() {
    return this._newWallet;
  }

  initNewWallet() {
    this._newWallet.set({
      password: '',
      confirmPassword: '',
    });
  }
}
