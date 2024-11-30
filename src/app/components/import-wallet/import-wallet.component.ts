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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.walletImportForm = this.fb.group({});

    this.selectPrivateKey();
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
      : this.mnemonicLength === '12'
      ? this.mnemonic12
      : this.mnemonic24;
  }

  selectPrivateKey() {
    this.selectedType = 'privateKey';
    this.walletImportForm.reset();
    this.walletImportForm.addControl(
      'privateKey',
      this.fb.control('', [Validators.required])
    );
  }

  selectMnemonic() {
    this.selectedType = 'mnemonic';
    this.walletImportForm.reset();
    

    this.walletImportForm.addControl(
      'mnemonicLength',
      this.fb.control('', [Validators.required, Validators.minLength(12)])
    );

    // Add the correct mnemonic field and validator
    if (this.mnemonicLength === '12') {
      this.walletImportForm.addControl(
        'mnemonic',
        this.fb.control('', [Validators.required, Validators.minLength(12)])
      );
    } else {
      this.walletImportForm.addControl(
        'mnemonic',
        this.fb.control('', [Validators.required, Validators.minLength(24)])
      );
    }
  }

  onMnemonicLengthChange(event: any) {
    // Update form validation when the mnemonic length changes
    if (this.selectedType === 'mnemonic') {
      this.walletImportForm.reset();
      this.selectMnemonic();
    }
  }

  async onSubmit() {
    const formValue = this.walletImportForm.value;
    let importData: string;
    const walletData = {};

    if (this.selectedType === 'privateKey') {
      importData = formValue.privateKey.trim();
    } else {
      importData =
        this.mnemonicLength === '12'
          ? formValue.mnemonic12.trim()
          : formValue.mnemonic24.trim();
    }

    try {
      const walletCount = await this.walletService.getWalletsCount();
      const walletData: { sucess: boolean; error?: string } = await this.walletService.addWalletPrivateKey(
        'Saved Wallet ' + walletCount,
        importData
      );

      if (walletData && walletData.sucess) {
        this.router.navigate(['/wallet-selection']);
      } else {
        this.importError = walletData?.error || 'Failed to import wallet.';
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      this.importError = 'Error importing wallet. Please try again.';
    }
  }
}
