import { Component, computed, inject, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletActionResult, WalletActionResultType, CommitRevealActionResult, ProtocolType } from '@kaspacom/wallet-messages';
import { CompletedActionOverviewService } from '../../../services/action-info-services/completed-action-overview.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { AssetsStoreService } from '../../../services/assets-store.service';
import { Krc20MetadataService } from '../../../services/asset-metadata/krc20-metadata.service';

@Component({
    selector: 'completed-action-review',
    templateUrl: './completed-action-review.component.html',
    styleUrls: ['./completed-action-review.component.scss'],
    imports: [NgIf, NgFor, SompiToNumberPipe]
})
export class CompletedActionReview {
  completedActionOverviewService = inject(CompletedActionOverviewService);
  private walletActionService = inject(WalletActionService);
  private assetsStore = inject(AssetsStoreService);
  private krc20MetadataService = inject(Krc20MetadataService);

  currentActionDisplay = computed(() => this.completedActionOverviewService.getActionDisplay(this.actionResult));

  @Input() actionResult!: WalletActionResult;

  onDone() {
    // Check if this was a KRC20 transaction and trigger assets update
    this.handlePostTransactionUpdates();
    
    // Clear the action result to dismiss the modal
    this.walletActionService.clearActionResult();
  }

  private async handlePostTransactionUpdates(): Promise<void> {
    if (this.isKrc20Transaction()) {
      console.log('[CompletedActionReview] KRC20 transaction detected, triggering assets update');
      // Trigger KRC20 assets update to refetch latest balances (with loading state for user feedback)
      await this.assetsStore.reloadKrc20();
      // Refresh metadata service to sync with new balance data
      this.krc20MetadataService.refreshFromStore();
      console.log('[CompletedActionReview] KRC20 assets and metadata refreshed');
    }
  }

  private isKrc20Transaction(): boolean {
    try {
      // Check if this is a commit-reveal action result (used by KRC20)
      if (this.actionResult.type === WalletActionResultType.CommitReveal) {
        const commitRevealResult = this.actionResult as CommitRevealActionResult;
        
        // Check if the protocol is KASPLEX (used for KRC20 operations)
        if (commitRevealResult.protocol === ProtocolType.KASPLEX) {
          // Parse the protocol action to confirm it's a KRC20 operation
          const protocolAction = JSON.parse(commitRevealResult.protocolAction);
          
          // KRC20 operations have an 'op' field with values like 'transfer', 'mint', 'deploy', etc.
          return protocolAction && typeof protocolAction.op === 'string';
        }
      }
      
      return false;
    } catch (error) {
      console.warn('[CompletedActionReview] Error checking if KRC20 transaction:', error);
      return false;
    }
  }
}
