import {
  Component,
  computed,
  inject,
  signal,
  WritableSignal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent } from 'kaspacom-ui';
import { KcIconComponent } from 'kaspacom-ui';
import { PriorityFeeSelectionComponent } from '../../../../../../components/wallet-actions-reviews/priority-fee-selection/priority-fee-selection.component';
import {
  ApprovalFlowService,
  ApprovalFlowState,
  L2PriorityInfo,
} from '../../../../../services/approval-flow.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { ReviewActionDataService } from '../../../../../../services/action-info-services/review-action-data.service';
import { WalletActionType } from '../../../../../../types/wallet-action';
import { InputFieldType } from '../../../../../../types/action-display.type';
import {
  EIP1193RequestPayload,
  EIP1193RequestType,
} from '@kaspacom/wallet-messages';
import { ApprovalSuccessPageComponent } from './components/approval-success-page.component';
import { ApprovalLoadingPageComponent } from './components/approval-loading-page.component';
import { L2PriorityFeeSelectionComponent } from '../../../../../../components/wallet-actions-reviews/l2-priority-fee-selection/l2-priority-fee-selection.component';
import { SwapApprovalComponent } from './components/swap-approval.component';
import { SwapContextService } from '../../../../../services/swap-context.service';

@Component({
  selector: 'app-approval-flow-page',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcIconComponent,
    PriorityFeeSelectionComponent,
    L2PriorityFeeSelectionComponent,
    ApprovalSuccessPageComponent,
    ApprovalLoadingPageComponent,
    SwapApprovalComponent,
  ],
  templateUrl: './approval-flow-page.component.html',
  styleUrl: './approval-flow-page.component.scss',
})
export class ApprovalFlowPageComponent implements OnDestroy {
  public approvalFlowService = inject(ApprovalFlowService);
  private walletService = inject(WalletService);
  private reviewActionDataService = inject(ReviewActionDataService);
  private swapContextService = inject(SwapContextService);

  // Expose enums for template
  WalletActionType = WalletActionType;
  InputFieldType = InputFieldType;
  ApprovalFlowState = ApprovalFlowState;

  // Computed properties
  approvalConfig = computed(() =>
    this.approvalFlowService.currentApprovalConfig(),
  );
  wallet = computed(() => this.walletService.getCurrentWallet()!);
  currentState = computed(() => this.approvalFlowService.currentState());

  // Swap context detection
  swapContext = computed(() => this.swapContextService.getSwapContext());
  isSwapTransaction = computed(() => this.swapContextService.hasSwapContext());

  actionDisplay = computed(() => {
    const config = this.approvalConfig();
    if (!config) return undefined;
    return this.reviewActionDataService.getActionDisplay(
      config.action,
      this.wallet(),
    );
  });

  isActionHasPriorityFee = computed(() => {
    const config = this.approvalConfig();
    if (!config) return false;

    if (
      [
        WalletActionType.SIGN_MESSAGE,
        WalletActionType.APPROVE_COMMUNICATION_APP,
      ].includes(config.action.type)
    ) {
      return false;
    }

    if (config.action.type === WalletActionType.EIP1193_PROVIDER_REQUEST) {
      const actionData = config.action
        .data as EIP1193RequestPayload<EIP1193RequestType>;
      if (actionData.method != EIP1193RequestType.KAS_SEND_TRANSACTION) {
        return false;
      }
    }

    return true;
  });

  isActionHasL2PriorityFee = computed(() => {
    const config = this.approvalConfig();
    if (!config) return false;
    if (config.action.type !== WalletActionType.EIP1193_PROVIDER_REQUEST)
      return false;

    const actionData = config.action
      .data as EIP1193RequestPayload<EIP1193RequestType>;

    return [
      EIP1193RequestType.KAS_SEND_TRANSACTION,
      EIP1193RequestType.SEND_TRANSACTION,
    ].includes(actionData.method);
  });

  isL2PriorityFieldsHasBeenFilled = computed(() => {
    return (
      this.currentL2PriorityFee() &&
      this.currentL2PriorityFee()?.baseFee !== undefined &&
      this.currentL2PriorityFee()?.priorityFee !== undefined &&
      this.currentL2PriorityFee()?.gasLimit !== undefined
    );
  });

  // Form state
  protected currentPriorityFee: bigint | undefined = undefined;
  protected currentL2PriorityFee: WritableSignal<
    Partial<L2PriorityInfo> | undefined
  > = signal(undefined);
  protected additionalParams: { [key: string]: any } = {};
  protected isLoading = false;

  isAvailableForApproval = computed(() => {
    if (this.isLoading) {
      return false;
    }

    if (
      this.isActionHasPriorityFee() &&
      this.currentPriorityFee === undefined
    ) {
      return false;
    }

    if (
      this.isActionHasL2PriorityFee() &&
      !this.isL2PriorityFieldsHasBeenFilled()
    ) {
      return false;
    }

    return true;
  });

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
        l2PriorityInfo: this.currentL2PriorityFee() as L2PriorityInfo,
        priorityFee: this.currentPriorityFee,
        additionalParams: this.additionalParams,
      });
    } catch (error) {
      console.error('Error during approval:', error);
      this.isLoading = false;
      this.approvalFlowService.setErrorState('Failed to process approval');
    }
  }

  onReject() {
    this.approvalFlowService.resolveApproval({
      isApproved: false,
    });
  }

  ngOnDestroy() {
    // If the component is destroyed while approval is still pending
    // (e.g. user navigated back), reject the pending approval cleanly
    this.approvalFlowService.rejectIfPending();
  }

  setCurrentPriorityFee(priorityFee: bigint | undefined) {
    this.currentPriorityFee = priorityFee;
  }

  setL2CurrentPriorityFee(
    info:
      | {
          priorityFee: bigint;
          baseFee: bigint;
        }
      | undefined,
  ) {
    if (info == undefined) {
      this.currentL2PriorityFee.set(undefined);
      return;
    }

    this.currentL2PriorityFee.set(this.currentL2PriorityFee() || {});
    this.currentL2PriorityFee.set({
      ...this.currentL2PriorityFee(),
      baseFee: info.baseFee,
      priorityFee: info.priorityFee,
    });
  }

  setL2GasLimit(gasLimit: bigint | undefined) {
    if (!gasLimit) {
      this.currentL2PriorityFee.set(undefined);
      return;
    }

    this.currentL2PriorityFee.set(this.currentL2PriorityFee() || {});
    this.currentL2PriorityFee.set({
      ...this.currentL2PriorityFee(),
      gasLimit: gasLimit,
    });
  }
}
