import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { KcNumberInputComponent, KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import {
  KaspaNetworkActionsService,
  MINIMAL_AMOUNT_TO_SEND,
} from '../../../../../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { Krc20TokenLogoComponent } from '../../../../../../../home/assets-lists/l1/logo/krc20-token-logo/krc20-token-logo.component';
import { CheckboxInputComponent } from '../../../../../../../../../shared/ui/input/checkbox/checkbox-input/checkbox-input.component';

@Component({
  selector: 'app-send-kaspa',
  standalone: true,
  imports: [
    CommonModule,
    KcNumberInputComponent,
    CheckboxInputComponent,
    KcButtonComponent,
    FormsModule,
    Krc20TokenLogoComponent,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-kaspa.component.html',
  styleUrl: './send-kaspa.component.scss',
})
export class SendKaspaComponent
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy
{
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private utilsHelper = inject(UtilsHelper);
  private notificationService = inject(NotificationService);
  private approvalFlowService = inject(ApprovalFlowService);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);

  // Form data
  walletAddress: string = '';
  kaspaAmount: string = '';
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

  // Track if fields have been touched/interacted with
  private addressTouched = false;
  private amountTouched = false;

  // Available balance for display and max functionality
  availableBalance = computed(() => {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      return 0;
    }
    const currentBalance =
      currentWallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;
    return this.kaspaNetworkActionsService.sompiToNumber(currentBalance);
  });

  constructor() {
    super();

    // Effect to watch for approval flow completion
    effect(() => {
      const completion = this.approvalFlowService.completion();
      if (completion && this.waitingForApprovalCompletion) {
        this.waitingForApprovalCompletion = false;

        if (completion.success) {
          // Transaction was successful, navigate back
          this.notificationService.success('Success',
            'Transaction sent successfully!',
          );
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });

    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-kaspa') {
        // Reset form when navigating to this page
        this.walletAddress = '';
        this.kaspaAmount = '';
        this.replaceByFee = false;
        this.addressTouched = false;
        this.amountTouched = false;
        this.resolvedToAddress = null;
        this.validateAddress();
        this.validateAmount();
      }
    });
  }

  override ngOnInit() {
    // Remove duplicate effects from here since they're now in constructor
  }

  override ngOnDestroy() {
    // Clean up QR scanner when component is destroyed
    this.qrScannerService.stopScanning();
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-kaspa',
      title: 'Send Kaspa',
      canNavigateBack: true,
    };
  }

  onWalletAddressChange(value: any): void {
    this.walletAddress = value || '';
    this.addressTouched = true;
    this.validateAddress();
  }

  onAddressResolved(result: any): void {
    // Do not overwrite the input value; keep the domain text if any
    if (result?.effectiveAddress) {
      this.resolvedToAddress = result.effectiveAddress;
      this.isAddressValid = true;
      this.addressErrorMessage = '';
    } else if (result?.source === 'kns' && result?.error) {
      this.resolvedToAddress = null;
      this.isAddressValid = false;
      this.addressErrorMessage = result.error;
    } else {
      this.resolvedToAddress = null;
      this.validateAddress();
    }
  }

  onAmountChange(value: any): void {
    this.kaspaAmount = value?.toString() || '';
    this.amountTouched = true;
    this.validateAmount();
  }

  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }

  onMaxAmountClick(): void {
    const maxAmount = this.availableBalance();
    this.kaspaAmount = maxAmount > 0 ? maxAmount.toString() : '';
    this.amountTouched = true;
    this.validateAmount();
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-kaspa',
        title: 'Scan Kaspa Address',
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

  private validateAmount(): void {
    const amount = Number(this.kaspaAmount);

    if (!this.kaspaAmount) {
      this.isAmountValid = !this.amountTouched;
      this.amountErrorMessage = this.amountTouched ? 'Amount is required' : '';
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }

    const minimalAmount = this.kaspaNetworkActionsService.sompiToNumber(
      MINIMAL_AMOUNT_TO_SEND,
    );
    if (amount < minimalAmount) {
      this.isAmountValid = false;
      this.amountErrorMessage = `Amount must be at least ${minimalAmount} KAS`;
      return;
    }

    if (amount > this.availableBalance()) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Insufficient balance';
      return;
    }

    this.isAmountValid = true;
    this.amountErrorMessage = '';
  }

  private validateAddress(): void {
    if (!this.walletAddress) {
      this.isAddressValid = !this.addressTouched;
      this.addressErrorMessage = this.addressTouched
        ? 'Wallet address is required'
        : '';
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
    this.addressErrorMessage = 'Invalid wallet address format';
  }

  async onSendClick(): Promise<void> {
    // Mark fields as touched so validation errors show if invalid
    this.addressTouched = true;
    this.amountTouched = true;

    this.validateAddress();
    this.validateAmount();

    if (!this.isAddressValid || !this.isAmountValid) {
      return;
    }

    if (this.isLoading) {
      return;
    }

    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.notificationService.error('Error', 'No wallet selected');
      return;
    }

    this.isLoading = true;

    try {
      // Ensure wallet is ready for transactions
      await currentWallet.waitForWalletToBeReadyForTransactions();

      // Check if utxo processor manager is available
      if (!currentWallet.getUtxoProcessorManager()) {
        this.notificationService.error('Error',
          'Wallet is not ready for transactions. Please wait and try again.',
        );
        return;
      }

      const amountInSompi =
        this.kaspaNetworkActionsService.kaspaToSompiFromNumber(
          Number(this.kaspaAmount),
        );
      const toAddress = this.resolvedToAddress || this.walletAddress;

      const action = this.walletActionService.createTransferKasWalletAction(
        toAddress,
        amountInSompi,
        currentWallet,
        this.replaceByFee,
      );

      console.log(action, currentWallet, this.kaspaAmount);
      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(
          action,
          false,
        );

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.kaspaAmount = '';
        this.replaceByFee = false;
        this.resolvedToAddress = null;

        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.notificationService.success('Success',
            'Transaction sent successfully!',
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
          this.notificationService.error('Error', errorMessage);
        }

        // Reset the waiting flag if transaction failed
        this.waitingForApprovalCompletion = false;
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
      this.notificationService.error('Error', 'Failed to send transaction');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Override navigateBack to navigate to homepage with UTXOs tab selected
   */
  protected override navigateBack(): void {
    // Close the flow and navigate to homepage with UTXOs tab
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'utxos' } });
  }
}
