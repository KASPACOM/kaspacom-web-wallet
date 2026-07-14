import { Component, computed, inject, Input } from '@angular/core';

import { WalletActionResult } from '@kaspacom/wallet-messages';
import { CompletedActionOverviewService } from '../../../services/action-info-services/completed-action-overview.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { AssetsManagerService } from '../../../services/assets-manager/assets-manager.service';

@Component({
  selector: 'completed-action-review',
  templateUrl: './completed-action-review.component.html',
  styleUrls: ['./completed-action-review.component.scss'],
  imports: [],
})
export class CompletedActionReview {
  completedActionOverviewService = inject(CompletedActionOverviewService);
  private walletActionService = inject(WalletActionService);
  private assetsManager = inject(AssetsManagerService);

  currentActionDisplay = computed(() =>
    this.completedActionOverviewService.getActionDisplay(this.actionResult),
  );

  @Input() actionResult!: WalletActionResult;

  onDone() {
    // Clear the action result to dismiss the modal
    this.walletActionService.clearActionResult();
  }
}
