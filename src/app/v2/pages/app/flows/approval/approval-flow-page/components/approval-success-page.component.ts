import { Component, computed, inject, OnInit, input } from '@angular/core';

import { Router } from '@angular/router';
import {
  WalletActionResult,
  WalletActionResultType,
  CommitRevealActionResult,
  ProtocolType,
} from '@kaspacom/wallet-messages';
import { CompletedActionOverviewService } from '../../../../../../../services/action-info-services/completed-action-overview.service';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui-kit';
import { ApprovalFlowService } from '../../../../../../services/approval-flow.service';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { WalletActionService } from '../../../../../../../services/wallet-action.service';

@Component({
  selector: 'app-approval-success-page',
  standalone: true,
  imports: [KcButtonComponent, KcIconComponent],
  template: `
    <div class="success-container">
      <!-- Success Header -->
      <div class="success-header">
        <h2 class="typo-title-3 success-title">{{ successTitle }}</h2>

        <!-- Success Icon -->
        <div class="success-icon-wrapper">
          <img
            src="/svgs/success.svg"
            alt="Success"
            class="success-icon"
            width="334"
            height="226"
          />
        </div>
      </div>

      <!-- Transaction Details Spoiler -->
      @if (actionDisplay()) {
        <div class="details-spoiler-container">
          <!-- Details Toggle Header -->
          <div class="details-spoiler-toggle" (click)="toggleDetails()">
            <div class="spoiler-left">
              <kc-icon iconClass="icon-info" size="sm" color="#6fc7ba" />
              <span class="spoiler-label">Transaction Details</span>
            </div>
            <div class="spoiler-chevron">
              <kc-icon
                [iconClass]="
                  showDetails ? 'icon-chevron-up' : 'icon-chevron-down'
                "
                size="sm"
                color="var(--gray-60, #9E9E9E)"
              />
            </div>
          </div>
          <!-- Details Content (Collapsible) -->
          <div
            class="details-content"
            [@slideDown]="showDetails ? 'open' : 'closed'"
          >
            <div class="details-inner">
              <h3 class="details-title">{{ actionDisplay()!.title }}</h3>
              <div class="details-grid">
                @for (row of actionDisplay()!.rows; track row) {
                  <div class="detail-item">
                    <div class="detail-label">{{ row.fieldName }}</div>
                    <div class="detail-value">
                      {{ row.fieldValue }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Action Button -->
      <div class="action-button">
        @if (pendingConfirmationMessage()) {
          <p class="pending-confirmation-message">
            {{ pendingConfirmationMessage() }}
          </p>
        }
        <kc-button
          [text]="isAwaitingConfirmation() ? 'Confirming...' : 'Done'"
          variant="primary"
          size="m"
          [isFullWidth]="true"
          [isDisabled]="isAwaitingConfirmation()"
          (buttonClick)="onDone()"
          class="done-button"
        />
        @if (isAwaitingConfirmation()) {
          <button type="button" class="skip-confirmation-link" (click)="onDone()">
            Skip waiting
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './approval-success-page.component.scss',
  animations: [
    trigger('slideDown', [
      state(
        'closed',
        style({
          height: '0px',
          opacity: 0,
          overflow: 'hidden',
        }),
      ),
      state(
        'open',
        style({
          height: '*',
          opacity: 1,
          overflow: 'visible',
        }),
      ),
      transition('closed => open', [animate('400ms ease-out')]),
      transition('open => closed', [animate('300ms ease-in')]),
    ]),
  ],
})
export class ApprovalSuccessPageComponent {
  private completedActionOverviewService = inject(
    CompletedActionOverviewService,
  );
  private approvalFlowService = inject(ApprovalFlowService);
  private router = inject(Router);
  private walletActionService = inject(WalletActionService);

  readonly actionResult = input.required<WalletActionResult>();

  // Spoiler state
  protected showDetails = false;

  get successTitle(): string {
    const actionResult = this.actionResult();
    if (!actionResult) {
      return 'Transaction Successful!';
    }

    switch (actionResult.type) {
      case WalletActionResultType.CompoundUtxos:
        return 'UTXOs compounded successfully!';
      default:
        return 'Transaction Successful!';
    }
  }

  actionDisplay = computed(() =>
    this.completedActionOverviewService.getActionDisplay(this.actionResult()),
  );

  /**
   * Covenant actions (TopUp, withdraw, keepAlive, etc.) resolve as "success"
   * here well before the covenant indexer's own listing catches up — closing
   * this page immediately let the user land on "My Contracts" while it still
   * showed the pre-action amount. The contracts page mirrors its indexer poll
   * into ApprovalFlowService.pendingConfirmation; only gate on it for
   * covenant actions, since every other action type never sets it.
   */
  isAwaitingConfirmation = computed(
    () =>
      this.isCovenantActionResult(this.actionResult()) &&
      this.approvalFlowService.pendingConfirmation()?.status === 'checking',
  );

  pendingConfirmationMessage = computed(() => {
    if (!this.isCovenantActionResult(this.actionResult())) return null;
    return this.approvalFlowService.pendingConfirmation()?.message ?? null;
  });

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  onDone() {
    // Covenant actions are dispatched from the contracts page, which stays
    // mounted behind the approval overlay with the action result rendered on
    // it — navigating to home would destroy that view, so only close the
    // overlay for those.
    if (!this.isCovenantActionResult(this.actionResult())) {
      // Determine the appropriate tab based on the action result
      const tab = this.getTabForActionResult(this.actionResult());

      // Navigate to homepage with the correct tab
      this.router.navigate(['/app/home'], { queryParams: { tab } });
    }

    // Close the approval flow
    this.approvalFlowService.closeApproval();

    // Clear the action result to dismiss the modal
    this.walletActionService.clearActionResult();
  }

  private isCovenantActionResult(actionResult: WalletActionResult): boolean {
    return [
      'deploy-covenant',
      'spend-covenant',
      'complete-covenant-partial',
    ].includes(actionResult?.type as string);
  }

  /**
   * Determines which tab to navigate to based on the completed action result
   */
  private getTabForActionResult(actionResult: WalletActionResult): string {
    switch (actionResult.type) {
      case WalletActionResultType.KasTransfer:
        // Kaspa transfer -> UTXOs tab
        return 'utxos';

      case WalletActionResultType.CommitReveal:
        // Protocol-based actions
        const commitRevealResult = actionResult as CommitRevealActionResult;
        switch (commitRevealResult.protocol) {
          case ProtocolType.KASPLEX:
            // KRC20 operations -> KRC20 tab
            return 'krc20';
          case ProtocolType.KNS:
            // KNS operations -> KNS tab
            return 'kns';
          case ProtocolType.KSPR:
            // KRC721/NFT operations -> KRC721 tab (KSPR protocol handles NFTs)
            return 'krc721';
          default:
            // Default fallback -> UTXOs tab
            return 'utxos';
        }

      default:
        // Default fallback for any other action types -> UTXOs tab
        return 'utxos';
    }
  }
}
