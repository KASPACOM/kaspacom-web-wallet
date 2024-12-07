import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { NgIf } from '@angular/common';
import { DEFAULT_DERIVED_PATH } from '../../config/consts';
import { UtilsHelper } from '../../services/utils.service';

@Component({
  selector: 'create-wallet',
  standalone: true,
  templateUrl: './create-wallet.component.html',
  styleUrls: ['./create-wallet.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf],
})
export class CreateWalletComponent implements OnInit {
  selectedType: 'privateKey' | 'mnemonic' = 'privateKey'; // Default selection is Private Key
  mnemonicLength: string = '12'; // Default to 12-word mnemonic
  mnemonic: string = '';
  password: string = '';
  creationError: string | null = null;

  constructor(
    private walletService: WalletService,
    private router: Router,
    private utils: UtilsHelper
  ) {}

  ngOnInit(): void {
    this.refreshMnemonic();
  }

  refreshMnemonic() {
    this.mnemonic = this.walletService.generateMnemonic(
      parseInt(this.mnemonicLength)
    );
  }

  getWalletAddress() {
    return this.walletService.getWalletAddressFromMnemonic(
      this.mnemonic,
      this.password
    );
  }

  async createWallet() {
    let walletAdditionResult: { sucess: boolean; error?: string } | null = null;

    try {
      const walletCount = await this.walletService.getWalletsCount();

      walletAdditionResult = await this.walletService.addWalletFromMemonic(
        'Saved Wallet ' + walletCount,
        this.mnemonic.trim(),
        DEFAULT_DERIVED_PATH,
        this.utils.isNullOrEmptyString(this.password)
          ? undefined
          : this.password
      );

      if (walletAdditionResult && walletAdditionResult.sucess) {
        this.router.navigate(['/wallet-selection']);
      } else {
        this.creationError =
          walletAdditionResult?.error || 'Failed to import wallet.';
      }
    } catch (error) {
      console.error('Error importing wallet:', error);
      this.creationError = 'Error importing wallet. Please try again.';
    }
  }
}
