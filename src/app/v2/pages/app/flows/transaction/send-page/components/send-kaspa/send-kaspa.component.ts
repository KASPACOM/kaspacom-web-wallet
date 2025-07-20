import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../../services/wallet-action.service';
import { KaspaNetworkActionsService, MINIMAL_AMOUNT_TO_SEND } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { UtilsHelper } from '../../../../../../../../services/utils.service';
import { MessagePopupService } from '../../../../../../../../services/message-popup.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { ApprovalFlowService } from '../../../../../common/services/approval-flow.service';

@Component({
  selector: 'app-send-kaspa',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule],
  templateUrl: './send-kaspa.component.html',
  styleUrl: './send-kaspa.component.scss'
})
export class SendKaspaComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);

  // Form data
  walletAddress: string = '';
  kaspaAmount: number | null = null;
  replaceByFee: boolean = false;

  // Loading state
  isLoading = false;

  // Track if we're waiting for approval flow completion
  private waitingForApprovalCompletion = false;

  // Validation states
  isAddressValid = true;
  isAmountValid = true;
  addressErrorMessage = '';
  amountErrorMessage = '';

  constructor() {
    super();
    
    // Effect to watch for approval flow completion
    effect(() => {
      const completion = this.approvalFlowService.completion();
      if (completion && this.waitingForApprovalCompletion) {
        this.waitingForApprovalCompletion = false;
        
        if (completion.success) {
          // Transaction was successful, navigate back
          this.messagePopupService.showSuccess('Transaction sent successfully!');
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-kaspa',
      title: 'Send Kaspa',
      canNavigateBack: true
    };
  }

  onWalletAddressChange(value: any): void {
    this.walletAddress = value || '';
    this.validateAddress();
  }

  onAmountChange(value: any): void {
    this.kaspaAmount = value ? Number(value) : null;
    this.validateAmount();
  }

  onRbfChange(value: any): void {
    this.replaceByFee = Boolean(value);
  }

  private validateAddress(): void {
    if (!this.walletAddress) {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Wallet address is required';
      return;
    }

    if (!this.utilsHelper.isValidWalletAddress(this.walletAddress)) {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Invalid wallet address format';
      return;
    }

    this.isAddressValid = true;
    this.addressErrorMessage = '';
  }

  private validateAmount(): void {
    if (!this.kaspaAmount || this.kaspaAmount <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }

    const amountInSompi = this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.kaspaAmount);
    const minAmountInKaspa = this.kaspaNetworkActionsService.sompiToNumber(MINIMAL_AMOUNT_TO_SEND);

    if (amountInSompi < MINIMAL_AMOUNT_TO_SEND) {
      this.isAmountValid = false;
      this.amountErrorMessage = `Minimum amount is ${minAmountInKaspa} KAS`;
      return;
    }

    // Check if wallet has sufficient balance
    const currentWallet = this.walletService.getCurrentWallet();
    if (currentWallet) {
      const currentBalance = currentWallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;
      const balanceInKaspa = this.kaspaNetworkActionsService.sompiToNumber(currentBalance);

      if (this.kaspaAmount > balanceInKaspa) {
        this.isAmountValid = false;
        this.amountErrorMessage = 'Insufficient balance';
        return;
      }
    }

    this.isAmountValid = true;
    this.amountErrorMessage = '';
  }

  private isFormValid(): boolean {
    this.validateAddress();
    this.validateAmount();
    return this.isAddressValid && this.isAmountValid && !this.isLoading;
  }

  async onSendClick(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.messagePopupService.showError('No wallet selected');
      return;
    }

    this.isLoading = true;

    try {
      const amountInSompi = this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.kaspaAmount!);

      const action = this.walletActionService.createTransferKasWalletAction(
        this.walletAddress,
        amountInSompi,
        currentWallet,
        this.replaceByFee
      );

      console.log(action, currentWallet, this.kaspaAmount);
      const result = await this.walletActionService.validateAndDoActionAfterApproval(action, false);

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.kaspaAmount = null;
        this.replaceByFee = false;
        
        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.messagePopupService.showSuccess('Transaction sent successfully!');
          // Navigate back to send page or close flow
          this.navigateBack();
        } else {
          // For v2 flow, wait for approval flow completion
          this.waitingForApprovalCompletion = true;
        }
      } else {
        if (result.errorCode !== ERROR_CODES.EIP1193.USER_REJECTED) {
          const errorMessage = result.errorCode
            ? ERROR_CODES_MESSAGES[result.errorCode]
            : ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR];
          this.messagePopupService.showError(errorMessage);
        }
        
        // Reset the waiting flag if transaction failed
        this.waitingForApprovalCompletion = false;
      }
    } catch (error) {
      console.error('Send transaction error:', error);
      this.messagePopupService.showError('An unexpected error occurred');
      this.waitingForApprovalCompletion = false;
    } finally {
      this.isLoading = false;
    }
  }
}
