import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { parseUnits } from 'ethers';
import { KcButtonComponent, KcInputComponent } from '@kaspacom/ui-kit';
import { TokenLogoComponent } from '../../../../../../../../../../components/token-logo/token-logo.component';
import { ERC20Contract } from '../../../../../../../../../../services/etherium-services/smart-contracts/contracts/erc20-contract';
import { MessagePopupService } from '../../../../../../../../../../services/message-popup.service';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-erc20',
  standalone: true,
  imports: [
    CommonModule,
    KcInputComponent,
    KcButtonComponent,
    FormsModule,
    TokenLogoComponent,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-erc20.component.html',
  styleUrl: './send-erc20.component.scss',
})
export class SendErc20Component
  extends FlowPageBaseComponent
  implements OnDestroy
{
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);

  // Token data
  token = signal<Erc20Token | undefined>(undefined);
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
          this.messagePopupService.showSuccess(
            'ERC20 token sent successfully!',
          );
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });

    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-erc20') {
        this.loadTokenData();
      }
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.qrScannerService.stopScanning();
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-erc20',
      title: `Send ${this.token()?.symbol || 'Token'}`,
      canNavigateBack: true,
    };
  }

  get availableBalance(): number {
    return this.token()?.balance || 0;
  }

  get isFormValid(): boolean {
    const amount = this.tokenAmount;
    return (
      this.isAddressValid &&
      this.isAmountValid &&
      !!this.walletAddress &&
      !!this.tokenAmount &&
      (amount || 0) > 0 &&
      !this.isLoading
    );
  }

  private async loadTokenData() {
    const tokenData = this.flowPagesService.activePage()?.data?.[
      'token'
    ] as Erc20Token;

    if (tokenData) {
      // Fallback to the passed token data
      this.token.set(tokenData);
      this.loading.set(false);
    } else {
      // No token data passed, can't proceed
      this.loading.set(false);
      this.messagePopupService.showError('No token selected');
      this.navigateBack();
    }
  }

  onWalletAddressChange(address: string): void {
    this.walletAddress = address;
    this.validateAddress();
  }

  onAmountChange(amount: any): void {
    const parsed = Number(amount);
    this.tokenAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    this.validateAmount();
  }

  onMaxAmountClick(): void {
    this.tokenAmount = this.availableBalance;
    this.validateAmount();
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-erc20',
        title: 'Scan ERC20 Address',
        onSuccess: (address: string) => {
          this.walletAddress = address;
          this.validateAddress();
        },
        onError: (error: string) => {
          console.error('QR scanning error:', error);
        },
      });
    }
  }

  private validateAddress(): void {
    if (!this.walletAddress || this.walletAddress.trim() === '') {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Address is required';
      return;
    }

    if (this.utilsHelper.isValidEthereumAddress(this.walletAddress)) {
      this.isAddressValid = true;
      this.addressErrorMessage = '';
      return;
    }

    this.isAddressValid = false;
    this.addressErrorMessage = 'Invalid wallet address';
  }

  private validateAmount(): void {
    const parsed = Number(this.tokenAmount);
    const balance = this.availableBalance;

    if (!this.tokenAmount || !Number.isFinite(parsed) || parsed <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }

    if (parsed > balance) {
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
      const toAddress = this.walletAddress;

      const tokenContract = ERC20Contract.getContract(
        this.token()!.address,
        this.walletService,
        this.walletActionService,
      );

      if (!this.tokenAmount || !this.token()?.decimals) {
        throw new Error('Invalid token amount or decimals');
      }

      // Create KRC20 transfer action
      const result = await tokenContract.transfer(
        toAddress,
        parseUnits(this.tokenAmount!.toString(), this.token()!.decimals),
      );

      console.log(
        'ERC20 Transfer Action:',
        result,
        currentWallet,
        this.tokenAmount,
      );

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.tokenAmount = null;
        this.replaceByFee = false;

        // For v2 flow, wait for approval flow completion
        this.waitingForApprovalCompletion = true;
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
      console.error('Error sending ERC20 token:', error);
      this.messagePopupService.showError('Failed to send ERC20 token');
      this.waitingForApprovalCompletion = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Override navigateBack to navigate to homepage with KRC20 tab selected
   */
  protected override navigateBack(): void {
    // Close the flow and navigate to homepage with KRC20 tab
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'erc20' } });
  }
}
