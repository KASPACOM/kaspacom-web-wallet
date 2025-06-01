import { Injectable, signal } from '@angular/core';

export interface IImportExistingWallet {
  seedPhrase: string;
  privateKey: string;
  password: string;
  confirmPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImportExistingFlowService {
  private _model = signal<IImportExistingWallet>({
    seedPhrase: '',
    privateKey: '',
    password: '',
    confirmPassword: '',
  });

  get model() {
    return this._model;
  }

  init() {}

  printState() {
    console.log('Import Existing Wallet State:', this._model());
  }

  submitSeedPhraseStep(seedPhrase: string) {
    this._model.set({ ...this._model(), seedPhrase });
    this.printState();
  }
  submitPrivateKeyStep(privateKey: string) {
    this._model.set({ ...this._model(), privateKey });
    this.printState();
  }
}
