import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../../services/wallet-action.service';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { Krc20WalletActionService } from '../../../services/protocols/krc20/krc20-wallet-actions.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from 'kaspacom-wallet-messages';
import { MessagePopupService } from '../../../services/message-popup.service';

@Component({
    selector: 'deploy',
    templateUrl: './deploy.component.html',
    styleUrls: ['./deploy.component.scss'],
    imports: [NgIf, NgFor, FormsModule]
})
export class DeployComponent {
  protected selectedToken = '';
  protected maxSupply: number = 100000000;
  protected limitPerMint = 1000;
  protected preAllocation = 0;

  constructor(
    private walletActionService: WalletActionService,
    private krc20WalletActionService: Krc20WalletActionService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private messagePopupService: MessagePopupService,
  ) {}

  async deployToken() {
    const action = this.krc20WalletActionService.createDeployWalletAction(
      this.selectedToken,
      this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
        this.maxSupply || 0
      ),
      this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
        this.limitPerMint || 0
      ),
      this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
        this.preAllocation || 0
      )
    );
    const result =
      await this.walletActionService.validateAndDoActionAfterApproval(action);

    if (!result.success) {
      this.messagePopupService.showError(result.errorCode ? ERROR_CODES_MESSAGES[result.errorCode] : ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR]);
    }
  }
}
