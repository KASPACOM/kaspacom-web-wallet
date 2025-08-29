import { Injectable, inject, signal } from '@angular/core';
import { INewWallet } from '../interface/new-wallet.interface';
import { WalletService } from '../../../../../../services/wallet.service';
import { DEFAULT_DERIVED_PATH } from '../../../../../../config/consts';
import { UtilsHelper } from '../../../../../../services/utils.service';
import { PasswordManagerService } from '../../../../../../services/password-manager.service';

export interface IWalletCreationResult {
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NewWalletFlowService {
  private readonly walletService = inject(WalletService);

  private readonly utilsHelper = inject(UtilsHelper);

  private readonly passwordManagerService = inject(PasswordManagerService);

  private _newWallet = signal<INewWallet>({
    password: '',
    confirmPassword: '',
    seedPhraseWordCount: 12,
    seedPhrase: '',
    seedPassphrase: '',
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
      seedPassphrase: '',
      seedPhraseSaved: false,
      walletAddress: '',
    });
  }

  submitPasswordStep(password: string, confirmPassword: string) {
    this._newWallet.set({ ...this._newWallet(), password, confirmPassword });
    this.printState();
  }

  setSeedPassphrase(seedPassphrase: string) {
    this._newWallet.set({ ...this._newWallet(), seedPassphrase });
    this.printState();
  }

  private async createWallet(): Promise<IWalletCreationResult> {
    let walletAdditionResult: IWalletCreationResult | undefined = undefined;
    const newWallet = this._newWallet();

    try {
      const walletCount = this.walletService.getWalletsCount();
      const accountNumber =
        this.walletService.getWalletAccountNumberFromDerivedPath(
          DEFAULT_DERIVED_PATH,
        );

      const tmp = await this.walletService.addWalletFromMemonic(
        `Saved Wallet ${walletCount}`,
        newWallet.seedPhrase.trim(),
        DEFAULT_DERIVED_PATH,
        `# ${accountNumber}`,
        newWallet.seedPassphrase,
      );
      walletAdditionResult = { success: tmp.sucess, error: tmp.error };
    } catch (error) {
      console.error('Error creating wallet:', error);
      const creationError = 'Error creating wallet. Please try again.';
      walletAdditionResult = { success: false, error: creationError };
    }

    return walletAdditionResult;
  }

  async submitSeedPhraseStep(
    seedPhrase: string,
    seedPhraseWordCount: number,
  ): Promise<IWalletCreationResult> {
    const walletAddress = this.walletService.getWalletAddressFromMnemonic(
      seedPhrase,
      this._newWallet().seedPassphrase,
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
    // Only set a new saved password if there is no user data yet.
    if (!this.passwordManagerService.isUserHasSavedPassword()) {
      await this.passwordManagerService.setSavedPassword(
        this._newWallet().password,
      );
    }
    // Ensure the password is loaded for subsequent storage operations
    await this.passwordManagerService.checkAndLoadPassword(
      this._newWallet().password,
    );
    return await this.createWallet();
  }

  submitSeedPhraseSaved(seedPhraseSaved: boolean) {
    this._newWallet.set({ ...this._newWallet(), seedPhraseSaved });
    this.printState();
  }
}
