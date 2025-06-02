import { Injectable, inject, signal } from '@angular/core';
import { ImportSwitchMethod } from '../steps/import-switch-import-existing-step/component/import-switch/import-switch-method.enum';
import { WalletService } from '../../../../../../services/wallet.service';
import { DEFAULT_DERIVED_PATH } from '../../../../../../config/consts';
import { PasswordManagerService } from '../../../../../../services/password-manager.service';

export interface IImportExistingWallet {
  importSwitchMethod: ImportSwitchMethod;
  wordCount: number;
  seedPhrase: string;
  privateKey: string;
  password: string;
  confirmPassword: string;
}

export interface IWalletImportResult {
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImportExistingFlowService {
  private walletService = inject(WalletService);

  private passwordManagerService = inject(PasswordManagerService);

  private _model = signal<IImportExistingWallet>({
    importSwitchMethod: ImportSwitchMethod.SEED_PHRASE,
    wordCount: 12,
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

  submitSeedPhraseStep(
    seedPhrase: string,
    wordCount: number,
    importSwitchMethod: ImportSwitchMethod,
  ) {
    this._model.set({
      ...this._model(),
      seedPhrase,
      wordCount,
      importSwitchMethod,
    });
    this.printState();
  }

  submitPrivateKeyStep(
    privateKey: string,
    importSwitchMethod: ImportSwitchMethod,
  ) {
    this._model.set({ ...this._model(), privateKey, importSwitchMethod });
    this.printState();
  }

  async finalSubmit(password: string): Promise<IWalletImportResult> {
    this._model.set({ ...this._model(), password });
    let importResult: IWalletImportResult | undefined = undefined;

    try {
      const walletCount = this.walletService.getWalletsCount();

      const res1 = await this.passwordManagerService.setSavedPassword(
        this._model().password,
        true,
      );
      const res2 = await this.passwordManagerService.checkAndLoadPassword(
        this._model().password,
      );

      if (this._model().importSwitchMethod === ImportSwitchMethod.PRIVATE_KEY) {
        const tmp = await this.walletService.addWallet(
          'Saved Wallet ' + walletCount,
          this._model().privateKey.trim(),
          undefined,
          this._model().password,
        );
        importResult = { success: tmp.sucess, error: tmp.error };
      } else {
        const accountNumber =
          this.walletService.getWalletAccountNumberFromDerivedPath(
            DEFAULT_DERIVED_PATH,
          );
        const tmp = await this.walletService.addWalletFromMemonic(
          'Saved Wallet ' + walletCount,
          this._model().seedPhrase.trim(),
          DEFAULT_DERIVED_PATH,
          `# + ${accountNumber}`,
          this._model().password,
        );
        importResult = { success: tmp.sucess, error: tmp.error };
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      const importError = 'Error importing wallet. Please try again.';
      importResult = { success: false, error: importError };
    }
    return importResult;
  }
}
