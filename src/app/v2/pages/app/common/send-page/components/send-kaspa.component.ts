import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../services/wallet-action.service';
import { KaspaNetworkActionsService, MINIMAL_AMOUNT_TO_SEND } from '../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { UtilsHelper } from '../../../../../../services/utils.service';
import { MessagePopupService } from '../../../../../../services/message-popup.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';

@Component({
  selector: 'app-send-kaspa',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule],
  templateUrl: './send-kaspa.component.html',
  styleUrl: './send-kaspa.component.scss'
})
export class SendKaspaComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);

  walletAddress = '';
  kaspaAmount: number | null = null;
  replaceByFee = false;
  isLoading = false;

  // Validation states
  isAddressValid = true;
  isAmountValid = true;
  addressErrorMessage = '';
  amountErrorMessage = '';

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
        this.messagePopupService.showSuccess('Transaction sent successfully!');
        // Navigate back to send page or close flow
        this.navigateBack();
      } else {
        if (result.errorCode !== ERROR_CODES.EIP1193.USER_REJECTED) {
          const errorMessage = result.errorCode
            ? ERROR_CODES_MESSAGES[result.errorCode]
            : ERROR_CODES_MESSAGES[ERROR_CODES.GENERAL.UNKNOWN_ERROR];
          this.messagePopupService.showError(errorMessage);
        }
      }
    } catch (error) {
      console.error('Send transaction error:', error);
      this.messagePopupService.showError('An unexpected error occurred');
    } finally {
      this.isLoading = false;
    }
  }
}
