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

@Component({
  selector: 'app-wallet-import',
  standalone: true,
  templateUrl: './wallet-import.component.html',
  styleUrls: ['./wallet-import.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf],
})
export class WalletImportComponent implements OnInit {
  walletImportForm: FormGroup = new FormGroup({});
  selectedType: 'privateKey' | 'mnemonic' = 'privateKey'; // Default selection is Private Key
  mnemonicLength: number = 12; // Default to 12-word mnemonic
  importError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.walletImportForm = this.fb.group({
      privateKey: ['', Validators.required],
      mnemonicLength: [this.mnemonicLength, Validators.required],
      mnemonic12: ['', Validators.required],
      mnemonic24: ['', Validators.required],
    });

    this.selectPrivateKey();

    console.log(this.walletImportForm);
  }

  // Getter methods for the form controls
  get privateKey() {
    return this.walletImportForm.get('privateKey');
  }

  get mnemonic12() {
    return this.walletImportForm.get('mnemonic12');
  }

  get mnemonic24() {
    return this.walletImportForm.get('mnemonic24');
  }

  get mnemonicOrPrivateKey() {
    return this.selectedType === 'privateKey'
      ? this.privateKey
      : this.mnemonicLength === 12
      ? this.mnemonic12
      : this.mnemonic24;
  }

  selectPrivateKey() {
    this.selectedType = 'privateKey';
    this.walletImportForm
      .get('privateKey')
      ?.setValidators([Validators.required]);
    this.walletImportForm.get('mnemonic12')?.clearValidators();
    this.walletImportForm.get('mnemonic24')?.clearValidators();
    this.walletImportForm.get('mnemonicLength')?.clearValidators();
    this.walletImportForm.updateValueAndValidity();
  }

  selectMnemonic() {
    this.selectedType = 'mnemonic';
    this.walletImportForm.get('privateKey')?.clearValidators();
    this.walletImportForm
      .get('mnemonicLength')
      ?.setValidators([Validators.required]);
    this.walletImportForm.updateValueAndValidity();
  }

  onMnemonicLengthChange(event: any) {
    this.mnemonicLength = event.target.value;
  }

  async onSubmit() {
    const formValue = this.walletImportForm.value;
    let importData: string;
    const walletData = {};

    if (this.selectedType === 'privateKey') {
      importData = formValue.privateKey.trim();
    } else {
      importData =
        this.mnemonicLength === 12
          ? formValue.mnemonic12.trim()
          : formValue.mnemonic24.trim();
    }

    try {
      const walletCount = await this.walletService.getWalletsCount();
      const walletData = await this.walletService.addWalletPrivateKey('Saved Wallet ' + walletCount, importData);

      if (walletData) {
        this.router.navigate(['/dashboard']);
      } else {
        this.importError = 'Failed to import wallet.';
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      this.importError = 'Error importing wallet. Please try again.';
    }
  }
}
