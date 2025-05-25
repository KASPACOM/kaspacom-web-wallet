import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';
import { UtilsHelper } from '../../../services/utils.service';
import { MnemonicWordsComponent } from '../../shared/mnemonic-words/mnemonic-words.component';
import { DEFAULT_DERIVED_PATH } from '../../../config/consts';

@Component({
    selector: 'import-wallet',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MnemonicWordsComponent,
    ],
    templateUrl: './import-wallet.component.html',
    styleUrls: ['./import-wallet.component.scss']
})
export class ImportWalletComponent implements OnInit {
  selectedType: 'privateKey' | 'mnemonic' = 'privateKey';
  mnemonicLength: number = 12;
  walletImportForm: FormGroup;
  importError: string = '';

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private router: Router,
    private utils: UtilsHelper,
  ) {
    this.walletImportForm = this.fb.group({
      privateKey: ['', [Validators.required]],
      mnemonic: ['', [Validators.required]],
      derivedPath: [DEFAULT_DERIVED_PATH],
      passphrase: ['']
    });
  }

  ngOnInit() {
    this.updateFormValidation();
  }

  selectPrivateKey() {
    this.selectedType = 'privateKey';
    this.updateFormValidation();
  }

  selectMnemonic() {
    this.selectedType = 'mnemonic';
    this.updateFormValidation();
  }

  updateFormValidation() {
    if (this.selectedType === 'privateKey') {
      this.walletImportForm.get('privateKey')?.setValidators([Validators.required]);
      this.walletImportForm.get('mnemonic')?.clearValidators();
    } else {
      this.walletImportForm.get('privateKey')?.clearValidators();
      this.walletImportForm.get('mnemonic')?.setValidators([Validators.required]);
    }
    this.walletImportForm.get('privateKey')?.updateValueAndValidity();
    this.walletImportForm.get('mnemonic')?.updateValueAndValidity();
  }

  onMnemonicLengthChange() {
    // Clear the mnemonic when length changes
    this.walletImportForm.get('mnemonic')?.setValue('');
  }

  async onSubmit() {
    if (this.walletImportForm.invalid) {
      return;
    }

    const formValue = this.walletImportForm.value;
    let walletAdditionResult: { sucess: boolean; error?: string } | null = null;

    try {
      const walletCount = await this.walletService.getWalletsCount();

      if (this.selectedType === 'privateKey') {
        walletAdditionResult = await this.walletService.addWallet(
          'Saved Wallet ' + walletCount,
          formValue.privateKey.trim()
        );
      } else {
        walletAdditionResult = await this.walletService.addWalletFromMemonic(
          'Saved Wallet ' + walletCount,
          formValue.mnemonic.trim(),
          formValue.derivedPath.trim(),
          '#' + this.walletService.getWalletAccountNumberFromDerivedPath(formValue.derivedPath),
          this.utils.isNullOrEmptyString(formValue.passphrase) ? undefined : formValue.passphrase,
        );
      }

      if (walletAdditionResult && walletAdditionResult.sucess) {
        this.router.navigate(['/wallet-selection']);
      } else {
        this.importError =
          walletAdditionResult?.error || 'Failed to import wallet.';
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      this.importError = 'Error importing wallet. Please try again.';
    }
  }

  get privateKey() {
    return this.walletImportForm.get('privateKey');
  }
}
