import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { UtilsHelper } from '../../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../../services/wallet-action.service';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'deploy',
  standalone: true,
  templateUrl: './deploy.component.html',
  styleUrls: ['./deploy.component.scss'],
  imports: [NgIf, NgFor, FormsModule],
})
export class DeployComponent {
  protected selectedToken = '';
  protected maxSupply: number = 100000000;
  protected limitPerMint = 1000;
  protected preAllocation = 0;

  constructor(
    private utilsService: UtilsHelper,
    private walletActionService: WalletActionService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService
  ) {}

  async deployToken() {
    const action = this.walletActionService.createDeployWalletAction(
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
      alert(result.errorCode);
    }
  }
}
