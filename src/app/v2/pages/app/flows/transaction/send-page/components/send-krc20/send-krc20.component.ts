import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import {
  KcInputComponent,
  KcCheckboxComponent,
  KcButtonComponent,
  KcIconComponent,
} from '@kaspacom/ui';
import { FormsModule } from '@angular/forms';
import { IToken } from '../../../../../common/interfaces/token.interface';
import { TokenLogoComponent } from '../../../../../common/krc20/token-logo/token-logo.component';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../../services/wallet-action.service';
import { Krc20WalletActionService } from '../../../../../../../../services/protocols/krc20/krc20-wallet-actions.service';
import { KasplexKrc20Service } from '../../../../../../../../services/kasplex-api/kasplex-api.service';
import { UtilsHelper } from '../../../../../../../../services/utils.service';
import { MessagePopupService } from '../../../../../../../../services/message-popup.service';
import { ApprovalFlowService } from '../../../../../../../services/approval-flow.service';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { firstValueFrom } from 'rxjs';
import { KaspaNetworkActionsService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { AssetsStoreService } from '../../../../../../../../services/assets-store.service';
import { QrScannerService } from '../../../../../../../../services/qr-scanner.service';
import { AddressSmartInputComponent } from '../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { AddressResolutionResult } from '../../../../../../../../services/address-resolution.service';

@Component({
  selector: 'app-send-krc20',
  standalone: true,
  imports: [
    CommonModule,
    KcInputComponent,
    KcCheckboxComponent,
    KcButtonComponent,
    KcIconComponent,
    FormsModule,
    TokenLogoComponent,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-krc20.component.html',
  styleUrl: './send-krc20.component.scss',
})
export class SendKrc20Component
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy
{
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private krc20WalletActionService = inject(Krc20WalletActionService);
  private kasplexService = inject(KasplexKrc20Service);
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private assetsStore = inject(AssetsStoreService);
  private qrScannerService = inject(QrScannerService);

  // Token data
  token = signal<IToken | undefined>(undefined);
  loading = signal<boolean>(true);

  // Form data
  walletAddress: string = '';
  tokenAmount: number | null = null;
  replaceByFee: boolean = false;

  // Resolved address (from KNS) if present
  private resolvedToAddress: string | null = null;

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
            'KRC20 token sent successfully!',
          );
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

  override ngOnInit() {
    // Remove effects from here since they're now in constructor
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.qrScannerService.stopScanning();
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-krc20',
      title: `Send ${this.token()?.symbol || 'Token'}`,
      canNavigateBack: true,
    };
  }

  get availableBalance(): number {
    return this.token()?.balance || 0;
  }

  get isFormValid(): boolean {
    return (
      this.isAddressValid &&
      this.isAmountValid &&
      !!this.walletAddress &&
      !!this.tokenAmount &&
      this.tokenAmount > 0 &&
      !this.isLoading
    );
  }

  private async loadTokenData() {
    const tokenData = this.flowPagesService.activePage()?.data?.[
      'token'
    ] as IToken;

    if (tokenData) {
      // First try to get updated data from assets store
      const krc20Assets = this.assetsStore.krc20Assets();
      const storedToken = krc20Assets.find((t) => t.tick === tokenData.address);

      if (storedToken) {
        this.token.set({
          name: storedToken.tick,
          symbol: storedToken.tick.toUpperCase(),
          address: storedToken.tick,
          balance: storedToken.balance,
          usdPrice: 0.0,
        });
        this.loading.set(false);
      } else {
        // Fallback to the passed token data
        this.token.set(tokenData);
        this.loading.set(false);
      }
    } else {
      // No token data passed, can't proceed
      this.loading.set(false);
      this.messagePopupService.showError('No token selected');
      this.navigateBack();
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

  onAddressResolved(result: AddressResolutionResult): void {
    // Do not overwrite input value; keep domain text if any
    if (result.effectiveAddress) {
      this.resolvedToAddress = result.effectiveAddress;
      this.isAddressValid = true;
      this.addressErrorMessage = '';
    } else if (result.source === 'kns' && result.error) {
      this.resolvedToAddress = null;
      this.isAddressValid = false;
      this.addressErrorMessage = result.error;
    } else {
      this.resolvedToAddress = null;
      this.validateAddress();
    }
  }

  onAmountChange(amount: any): void {
    this.tokenAmount = amount || null;
    this.validateAmount();
  }

  onRbfChange(rbf: boolean): void {
    this.replaceByFee = rbf;
  }

  onMaxAmountClick(): void {
    console.log(
      'Max button clicked, available balance:',
      this.availableBalance,
    );
    this.tokenAmount = this.availableBalance;
    this.validateAmount();
    console.log('Token amount set to:', this.tokenAmount);
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-krc20',
        title: 'Scan KRC20 Address',
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

    if (
      this.utilsHelper.isValidWalletAddress(this.walletAddress) ||
      !!this.resolvedToAddress
    ) {
      this.isAddressValid = true;
      this.addressErrorMessage = '';
      return;
    }

    this.isAddressValid = false;
    this.addressErrorMessage = 'Invalid wallet address';
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
      const amountInSompi =
        this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
          this.tokenAmount!,
        );
      const toAddress = this.resolvedToAddress || this.walletAddress;

      // Create KRC20 transfer action
      const action = this.krc20WalletActionService.createTransferWalletAction(
        this.token()!.address, // ticker
        toAddress, // to address
        amountInSompi, // amount in sompi format
      );

      console.log(
        'KRC20 Transfer Action:',
        action,
        currentWallet,
        this.tokenAmount,
      );

      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(
          action,
          false,
        );

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.tokenAmount = null;
        this.replaceByFee = false;
        this.resolvedToAddress = null;

        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.messagePopupService.showSuccess(
            'KRC20 token sent successfully!',
          );
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
