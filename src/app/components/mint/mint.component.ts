import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { UtilsHelper } from '../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../services/wallet-action.service';

@Component({
  selector: 'mint',
  standalone: true,
  templateUrl: './mint.component.html',
  styleUrls: ['./mint.component.scss'],
  imports: [NgIf, NgFor, FormsModule],
})
export class MintComponent {
  protected selectedToken = '';

  constructor(
    private utilsService: UtilsHelper,
    private walletActionService: WalletActionService
  ) {}

  async mintToken() {
    if (!this.isTokenNameEmpty()) {
      const action = this.walletActionService.createMintWalletAction(this.selectedToken);
      const result = await this.walletActionService.validateAndDoActionAfterApproval(action);

      if (!result.success) {
        alert(result.errorCode);
      }
    }
  }

  isTokenNameEmpty() {
    return this.utilsService.isNullOrEmptyString(this.selectedToken);
  }
}
