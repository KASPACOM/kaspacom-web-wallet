import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { NgIf } from '@angular/common';
import { DEFAULT_DERIVED_PATH } from '../../config/consts';
import { UtilsHelper } from '../../services/utils.service';

@Component({
  selector: 'import-wallet',
  standalone: true,
  templateUrl: './import-wallet.component.html',
  styleUrls: ['./import-wallet.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf],
})
export class ImportWalletComponent implements OnInit {
  walletImportForm: FormGroup = new FormGroup({});
  selectedType: 'privateKey' | 'mnemonic' = 'privateKey'; // Default selection is Private Key
  mnemonicLength: string = '12'; // Default to 12-word mnemonic
  importError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private router: Router,
    private utils: UtilsHelper,
  ) {}

  ngOnInit(): void {
    this.walletImportForm = this.fb.group({
      privateKey: [''],
      mnemonic: [''],
      derivedPath: [DEFAULT_DERIVED_PATH],
      passphrase: [''],
    });

    this.selectPrivateKey();
  }

  // Getter methods for the form controls
  get privateKey() {
    return this.walletImportForm.get('privateKey');
  }

  get mnemonic() {
    return this.walletImportForm.get('mnemonic');
  }

  get derivedPath() {
    return this.walletImportForm.get('derivedPath');
  }

  get passphrase() {
    return this.walletImportForm.get('passphrase');
  }

  selectPrivateKey() {
    this.selectedType = 'privateKey';
  }

  selectMnemonic() {
    this.selectedType = 'mnemonic';
  }

  async onSubmit() {
    const formValue = this.walletImportForm.value;
    let walletAdditionResult: { sucess: boolean; error?: string } | null = null;

    try {
      const walletCount = await this.walletService.getWalletsCount();

      if (this.selectedType === 'privateKey') {
        walletAdditionResult = await this.walletService.addWalletFromPrivateKey(
          'Saved Wallet ' + walletCount,
          formValue.privateKey.trim()
        );
      } else {
        walletAdditionResult = await this.walletService.addWalletFromMemonic(
          'Saved Wallet ' + walletCount,
          formValue.mnemonic.trim(),
          formValue.derivedPath.trim(),
          this.utils.isNullOrEmptyString(formValue.passphrase) ? undefined : formValue.passphrase 
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
}
