import { Injectable, inject, signal } from '@angular/core';
import { ImportSwitchMethod } from '../steps/import-switch-import-existing-step/component/import-switch/import-switch-method.enum';
import { WalletService } from '../../../../../../services/wallet.service';
import { DEFAULT_DERIVED_PATH } from '../../../../../../config/consts';
import { PasswordManagerService } from '../../../../../../services/password-manager.service';

export interface IImportExistingWallet {
  importSwitchMethod: ImportSwitchMethod;
  wordCount: number;
  seedPhrase: string;
  seedPassphrase: string;
  privateKey: string;
  password: string;
  confirmPassword: string;
}

export interface IWalletImportResult {
  success: boolean;
  error?: string;
}

const INIT_INFO = {
  importSwitchMethod: ImportSwitchMethod.SEED_PHRASE,
  wordCount: 12,
  seedPhrase: '',
  seedPassphrase: '',
  privateKey: '',
  password: '',
  confirmPassword: '',
};

@Injectable({
  providedIn: 'root',
})
export class ImportExistingFlowService {
  private walletService = inject(WalletService);

  private passwordManagerService = inject(PasswordManagerService);

  private _model = signal<IImportExistingWallet>({ ...INIT_INFO });

  private _skipPassword = false;

  setSkipPassword(skip: boolean) {
    this._skipPassword = skip;
  }

  isSkipPassword(): boolean {
    return this._skipPassword;
  }

  get model() {
    return this._model;
  }

  init() {
    this._model.set({
      ...INIT_INFO
    });
  }

  printState() { }

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

  submitSeedPassphraseStep(seedPassphrase: string) {
    this._model.set({
      ...this._model(),
      seedPassphrase,
    });
    this.printState();
  }

  setImportSwitchMethod(method: ImportSwitchMethod) {
    this._model.set({
      ...this._model(),
      importSwitchMethod: method,
    });
    this.printState();
  }

  submitPrivateKeyStep(
    privateKey: string,
    importSwitchMethod: ImportSwitchMethod,
  ) {
    this._model.set({
      ...this._model(),
      privateKey,
      importSwitchMethod,
    });
    this.printState();
  }

  async finalSubmit(password: string): Promise<IWalletImportResult> {
    this._model.set({ ...this._model(), password });
    let importResult: IWalletImportResult | undefined = undefined;

    try {
      const walletCount = this.walletService.getWalletsCount();

      // Only set a new saved password if there is no user data yet.
      if (!this.passwordManagerService.isUserHasSavedPassword()) {
        await this.passwordManagerService.setSavedPassword(
          this._model().password,
        );
      }
      // Ensure password is loaded
      await this.passwordManagerService.checkAndLoadPassword(
        this._model().password,
      );

      if (this._model().importSwitchMethod === ImportSwitchMethod.PRIVATE_KEY) {
        const tmp = await this.walletService.addWallet(
          'Saved Wallet ' + walletCount,
          this._model().privateKey.trim(),
          undefined,
          undefined,
          undefined,
          false,
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
          `# ${accountNumber}`,
          this._model().seedPassphrase,
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

  async finalSubmitSkipPassword(): Promise<IWalletImportResult> {
    let importResult: IWalletImportResult | undefined = undefined;

    try {
      const walletCount = this.walletService.getWalletsCount();

      if (this._model().importSwitchMethod === ImportSwitchMethod.PRIVATE_KEY) {
        const tmp = await this.walletService.addWallet(
          'Saved Wallet ' + walletCount,
          this._model().privateKey.trim(),
          undefined,
          undefined,
          undefined,
          false,
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
          `# ${accountNumber}`,
          this._model().seedPassphrase,
        );
        importResult = { success: tmp.sucess, error: tmp.error };
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      const importError = 'Error importing wallet. Please try again.';
      importResult = { success: false, error: importError };
    }

    return importResult!;
  }
}
