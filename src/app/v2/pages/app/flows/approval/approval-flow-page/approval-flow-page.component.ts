import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent } from 'kaspacom-ui';
import { KcIconComponent } from 'kaspacom-ui';
import { PriorityFeeSelectionComponent } from '../../../../../../components/wallet-actions-reviews/priority-fee-selection/priority-fee-selection.component';
import { ApprovalFlowService, ApprovalFlowState } from '../../../common/services/approval-flow.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { ReviewActionDataService } from '../../../../../../services/action-info-services/review-action-data.service';
import { WalletActionType } from '../../../../../../types/wallet-action';
import { InputFieldType } from '../../../../../../types/action-display.type';
import { EIP1193RequestPayload, EIP1193RequestType } from '@kaspacom/wallet-messages';
import { ApprovalSuccessPageComponent } from './components/approval-success-page.component';
import { ApprovalLoadingPageComponent } from './components/approval-loading-page.component';

@Component({
  selector: 'app-approval-flow-page',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcIconComponent,
    PriorityFeeSelectionComponent,
    ApprovalSuccessPageComponent,
    ApprovalLoadingPageComponent
  ],
  templateUrl: './approval-flow-page.component.html',
  styleUrl: './approval-flow-page.component.scss'
})
export class ApprovalFlowPageComponent {
  public approvalFlowService = inject(ApprovalFlowService);
  private walletService = inject(WalletService);
  private reviewActionDataService = inject(ReviewActionDataService);

  // Expose enums for template
  WalletActionType = WalletActionType;
  InputFieldType = InputFieldType;
  ApprovalFlowState = ApprovalFlowState;

  // Computed properties
  approvalConfig = computed(() => this.approvalFlowService.currentApprovalConfig());
  wallet = computed(() => this.walletService.getCurrentWallet()!);
  currentState = computed(() => this.approvalFlowService.currentState());
  
  actionDisplay = computed(() => {
    const config = this.approvalConfig();
    if (!config) return undefined;
    return this.reviewActionDataService.getActionDisplay(config.action, this.wallet());
  });

  isActionHasPriorityFee = computed(() => {
    const config = this.approvalConfig();
    if (!config) return false;

    if ([WalletActionType.SIGN_MESSAGE, WalletActionType.APPROVE_COMMUNICATION_APP].includes(config.action.type)) {
      return false;
    }

    if (config.action.type === WalletActionType.EIP1193_PROVIDER_REQUEST) {
      const actionData = config.action.data as EIP1193RequestPayload<EIP1193RequestType>;
      if (actionData.method != EIP1193RequestType.KAS_SEND_TRANSACTION) {
        return false;
      }
    }

    return true;
  });

  // Form state
  protected currentPriorityFee: bigint | undefined = undefined;
  protected additionalParams: { [key: string]: any } = {};
  protected isLoading = false;

  isAvailableForApproval(): boolean {
    return !this.isLoading && (this.currentPriorityFee !== undefined || !this.isActionHasPriorityFee());
  }

  async onAccept() {
    if (!this.isAvailableForApproval()) {
      return;
    }

    this.isLoading = true;

    try {
      // Resolve the approval to continue with transaction processing
      // The WalletActionService will handle the state transitions
      this.approvalFlowService.resolveApproval({
        isApproved: true,
        priorityFee: this.currentPriorityFee,
        additionalParams: this.additionalParams
      });
    } catch (error) {
      console.error('Error during approval:', error);
      this.isLoading = false;
      this.approvalFlowService.setErrorState('Failed to process approval');
    }
  }

  onReject() {
    this.approvalFlowService.resolveApproval({
      isApproved: false
    });
  }

  setCurrentPriorityFee(priorityFee: bigint | undefined) {
    this.currentPriorityFee = priorityFee;
  }
} 