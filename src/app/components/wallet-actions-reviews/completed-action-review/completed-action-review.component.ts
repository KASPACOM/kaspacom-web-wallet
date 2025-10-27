import { Component, computed, inject, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { WalletActionResult } from '@kaspacom/wallet-messages';
import { CompletedActionOverviewService } from '../../../services/action-info-services/completed-action-overview.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { AssetsManagerService } from '../../../services/assets-manager/assets-manager.service';

@Component({
    selector: 'completed-action-review',
    templateUrl: './completed-action-review.component.html',
    styleUrls: ['./completed-action-review.component.scss'],
    imports: [NgIf, NgFor]
})
export class CompletedActionReview {
  completedActionOverviewService = inject(CompletedActionOverviewService);
  private walletActionService = inject(WalletActionService);
  private assetsManager = inject(AssetsManagerService);

  currentActionDisplay = computed(() => this.completedActionOverviewService.getActionDisplay(this.actionResult));

  @Input() actionResult!: WalletActionResult;

  onDone() {
    // Check if this was a KRC20 transaction and trigger assets update
    this.handlePostTransactionUpdates();

    // Clear the action result to dismiss the modal
    this.walletActionService.clearActionResult();
  }

  private async handlePostTransactionUpdates(): Promise<void> {
    console.log('handlePostTransactionUpdates');
    await this.assetsManager.reloadAllCurrentAssetsAfterUpdate();
  }
}
