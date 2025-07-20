import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { IToken } from '../../../../../common/interfaces/token.interface';
import { TokenLogoComponent } from '../../../../../common/token-logo/token-logo.component';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../../services/wallet-action.service';
import { Krc20WalletActionService } from '../../../../../../../../services/protocols/krc20/krc20-wallet-actions.service';
import { KasplexKrc20Service } from '../../../../../../../../services/kasplex-api/kasplex-api.service';
import { UtilsHelper } from '../../../../../../../../services/utils.service';
import { MessagePopupService } from '../../../../../../../../services/message-popup.service';
import { ApprovalFlowService } from '../../../../../common/services/approval-flow.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { firstValueFrom } from 'rxjs';
import { KaspaNetworkActionsService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-send-krc20',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule, TokenLogoComponent],
  templateUrl: './send-krc20.component.html',
  styleUrl: './send-krc20.component.scss'
})
export class SendKrc20Component extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private krc20WalletActionService = inject(Krc20WalletActionService);
  private kasplexService = inject(KasplexKrc20Service);
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);

  // Token data
  token = signal<IToken | undefined>(undefined);
  loading = signal<boolean>(true);

  // Form data
  walletAddress: string = '';
  tokenAmount: number | null = null;
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
          this.messagePopupService.showSuccess('KRC20 token sent successfully!');
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });

    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-krc20') {
        this.loadTokenData();
      }
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    if (!this.token()) {
      this.loadTokenData();
    }
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-krc20',
      title: `Send ${this.token()?.name || 'KRC20'}`,
      canNavigateBack: true
    };
  }

  get availableBalance(): number {
    return this.token()?.balance || 0;
  }

  get isFormValid(): boolean {
    return this.isAddressValid && this.isAmountValid && 
           !!this.walletAddress && !!this.tokenAmount && 
           this.tokenAmount > 0 && !this.isLoading;
  }

  private async loadTokenData(): Promise<void> {
    try {
      this.loading.set(true);
      
      // Clear form data when loading new token
      this.walletAddress = '';
      this.tokenAmount = null;
      this.replaceByFee = false;
      
      // Get navigation data
      const navigationData = this.getNavigationData();
      
      if (!navigationData?.token) {
        console.warn('No token data provided in navigation data');
        return;
      }

      const tokenData = navigationData.token as IToken;
      
      // Refresh token balance and get token info (including decimals) from API
      const currentWallet = this.walletService.getCurrentWallet();
      if (currentWallet) {
        try {
          // Get both balance and token info in parallel
          const [balanceResponse, tokenInfoResponse] = await Promise.all([
            firstValueFrom(
              this.kasplexService.getTokenWalletBalanceInfo(currentWallet.getAddress(), tokenData.address)
            ),
            firstValueFrom(
              this.kasplexService.getTokenInfo(tokenData.address)
            )
          ]);
          
          if (balanceResponse.result?.[0] && tokenInfoResponse.result?.[0]) {
            // Update token with fresh balance and decimals info
            const tokenInfo = tokenInfoResponse.result[0];
            const updatedToken: IToken = {
              ...tokenData,
              balance: this.kaspaNetworkActionsService.sompiToNumber(BigInt(balanceResponse.result[0].balance)), // Convert from sompi
              decimals: parseInt(tokenInfo.dec || '0') // Include decimals information
            };
            this.token.set(updatedToken);
          } else {
            this.token.set(tokenData);
          }
        } catch (error) {
          console.error('Failed to refresh token balance:', error);
          this.token.set(tokenData);
        }
      } else {
        this.token.set(tokenData);
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private getNavigationData(): any {
    // Get data from current page configuration
    const currentPage = this.getCurrentConfig();
    return currentPage?.data || {};
  }

  onWalletAddressChange(address: string): void {
    this.walletAddress = address;
    this.validateAddress();
  }

  onAmountChange(amount: number): void {
    this.tokenAmount = amount;
    this.validateAmount();
  }

  onRbfChange(checked: boolean): void {
    this.replaceByFee = checked;
  }

  onMaxAmountClick(): void {
    this.tokenAmount = this.availableBalance;
    this.validateAmount();
  }

  private validateAddress(): void {
    if (!this.walletAddress || this.walletAddress.trim() === '') {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Address is required';
      return;
    }

    if (!this.utilsHelper.isValidWalletAddress(this.walletAddress)) {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Invalid wallet address';
      return;
    }

    this.isAddressValid = true;
    this.addressErrorMessage = '';
  }

  private validateAmount(): void {
    if (!this.tokenAmount || this.tokenAmount <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }

    if (this.tokenAmount > this.availableBalance) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Insufficient balance';
      return;
    }

    this.isAmountValid = true;
    this.amountErrorMessage = '';
  }

  async onSendClick(): Promise<void> {
    if (!this.isFormValid || !this.token()) {
      return;
    }

    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.messagePopupService.showError('No wallet selected');
      return;
    }

    this.isLoading = true;

    try {
      // Convert token amount to BigInt using kaspaToSompiFromNumber (same as working sendAsset function)
      const amountInSompi = this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.tokenAmount!);

      // Create KRC20 transfer action
      const action = this.krc20WalletActionService.createTransferWalletAction(
        this.token()!.address, // ticker
        this.walletAddress,    // to address
        amountInSompi          // amount in sompi format
      );

      console.log('KRC20 Transfer Action:', action, currentWallet, this.tokenAmount);
      
      const result = await this.walletActionService.validateAndDoActionAfterApproval(action, false);

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.tokenAmount = null;
        this.replaceByFee = false;
        
        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.messagePopupService.showSuccess('KRC20 token sent successfully!');
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
      console.error('Error sending KRC20 token:', error);
      this.messagePopupService.showError('Failed to send KRC20 token');
      this.waitingForApprovalCompletion = false;
    } finally {
      this.isLoading = false;
    }
  }
}