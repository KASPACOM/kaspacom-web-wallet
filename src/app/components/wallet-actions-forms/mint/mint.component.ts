import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { UtilsHelper } from '../../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../../services/wallet-action.service';
import { Krc20WalletActionService } from '../../../services/protocols/krc20/krc20-wallet-actions.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from 'kaspacom-wallet-messages';
import { MessagePopupService } from '../../../services/message-popup.service';

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
    private walletActionService: WalletActionService,
    private krc20ActionWalletService: Krc20WalletActionService,
    private messagePopupService: MessagePopupService,
  ) {}

  async mintToken() {
    if (!this.isTokenNameEmpty()) {
      const action = this.krc20ActionWalletService.createMintWalletAction(this.selectedToken);
      const result = await this.walletActionService.validateAndDoActionAfterApproval(action);

      if (!result.success) {
        this.messagePopupService.showError(result.errorCode ? ERROR_CODES_MESSAGES[result.errorCode] : ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR]);
      }
    }
  }

  isTokenNameEmpty() {
    return this.utilsService.isNullOrEmptyString(this.selectedToken);
  }
}
