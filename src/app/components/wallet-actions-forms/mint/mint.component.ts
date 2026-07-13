import { Component, inject } from '@angular/core';
import { NotificationService } from '@kaspacom/ui-kit';
import { FormsModule } from '@angular/forms';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { Krc20WalletActionService } from '../../../services/protocols/krc20/krc20-wallet-actions.service';
import { UtilsHelper } from '../../../services/utils.service';
import { WalletActionService } from '../../../services/wallet-action.service';

@Component({
  selector: 'mint',
  templateUrl: './mint.component.html',
  styleUrls: ['./mint.component.scss'],
  imports: [FormsModule],
})
export class MintComponent {
  private utilsService = inject(UtilsHelper);
  private walletActionService = inject(WalletActionService);
  private krc20ActionWalletService = inject(Krc20WalletActionService);
  private notificationService = inject(NotificationService);

  protected selectedToken = '';

  async mintToken() {
    if (!this.isTokenNameEmpty()) {
      const action = this.krc20ActionWalletService.createMintWalletAction(
        this.selectedToken,
      );
      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(action);

      if (!result.success) {
        this.notificationService.error('Error',
          result.errorCode
            ? ERROR_CODES_MESSAGES[result.errorCode]
            : ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR],
        );
      }
    }
  }

  isTokenNameEmpty() {
    return this.utilsService.isNullOrEmptyString(this.selectedToken);
  }
}
