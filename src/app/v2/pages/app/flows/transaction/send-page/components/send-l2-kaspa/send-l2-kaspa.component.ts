import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import {
  KcInputComponent,
  KcButtonComponent,
  KcIconComponent,
} from '@kaspacom/ui';
import { FormsModule } from '@angular/forms';
import { TokenLogoComponent } from '../../../../../common/krc20/token-logo/token-logo.component';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../../services/wallet-action.service';
import { MessagePopupService } from '../../../../../../../../services/message-popup.service';
import { ApprovalFlowService } from '../../../../../../../services/approval-flow.service';
import { QrScannerService } from '../../../../../../../../services/qr-scanner.service';
import { Router } from '@angular/router';
import { AddressSmartInputComponent } from '../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { NetworkSelectionService } from '../../../../../../../../services/network-selection.service';

@Component({
  selector: 'app-send-l2-kaspa',
  standalone: true,
  imports: [
    CommonModule,
    KcInputComponent,
    KcButtonComponent,
    KcIconComponent,
    FormsModule,
    TokenLogoComponent,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-l2-kaspa.component.html',
  styleUrl: './send-l2-kaspa.component.scss',
})
export class SendL2KaspaComponent
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy
{
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);
  private networkSelectionService = inject(
    NetworkSelectionService,
  ) as NetworkSelectionService;

  // Form data
  walletAddress: string = '';
  kaspaAmount: number | null = null;

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

    const currentNetwork = this.networkSelectionService.getCurrentNetwork();
    if (currentNetwork === 'l1-kaspa') {
      return 0; // Should not happen, but fallback
    }

    // For L2 networks
    const l2State = currentWallet.getL2WalletStateSignal()();
    if (!l2State) {
      return 0;
    }
    return l2State.balanceFormatted;
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
          this.messagePopupService.showSuccess(
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
      if (currentPage?.id === 'send-l2-kaspa') {
        // Reset form when navigating to this page
        this.walletAddress = '';
        this.kaspaAmount = null;
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
      id: 'send-l2-kaspa',
      title: 'Send Kaspa (L2)',
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
    this.kaspaAmount = value || null;
    this.amountTouched = true;
    this.validateAmount();
  }

  onMaxAmountClick(): void {
    this.kaspaAmount = this.availableBalance();
    this.validateAmount();
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-l2-kaspa',
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
    if (this.kaspaAmount === null || this.kaspaAmount === undefined) {
      this.isAmountValid = !this.amountTouched;
      this.amountErrorMessage = this.amountTouched ? 'Amount is required' : '';
      return;
    }

    if (this.kaspaAmount <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }

    if (this.kaspaAmount > this.availableBalance()) {
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

    // Basic address validation for L2 (simplified for now)
    if (this.walletAddress.length >= 30 && this.walletAddress.length <= 100) {
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
      this.messagePopupService.showError('No wallet selected');
      return;
    }

    this.isLoading = true;

    try {
      // For L2 transactions, we'll create a simplified flow for now
      // TODO: Implement actual L2 transaction logic

      // Show success message for now (placeholder implementation)
      this.messagePopupService.showSuccess(
        'L2 Kaspa transaction feature coming soon!',
      );
      this.navigateBack();
    } catch (error) {
      console.error('Error sending L2 transaction:', error);
      this.messagePopupService.showError('Failed to send L2 transaction');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Override navigateBack to navigate to homepage
   */
  protected override navigateBack(): void {
    // Close the flow and navigate to homepage
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home']);
  }
}
