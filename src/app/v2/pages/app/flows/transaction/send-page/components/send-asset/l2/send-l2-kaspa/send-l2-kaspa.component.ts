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
import { EIP1193RequestType } from '@kaspacom/wallet-messages';
import { parseUnits } from 'ethers';
import { KcNumberInputComponent, KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { TokenLogoComponent } from '../../../../../../../../../../components/token-logo/token-logo.component';
import { EthereumWalletChainManager } from '../../../../../../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-l2-kaspa',
  standalone: true,
  imports: [
    CommonModule,
    KcNumberInputComponent,
    KcButtonComponent,
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
  private notificationService = inject(NotificationService);
  private approvalFlowService = inject(ApprovalFlowService);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);
  private utilsHelper = inject(UtilsHelper);
  private ethereumWalletChainManager = inject(EthereumWalletChainManager);

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

    return currentWallet.getL2WalletStateSignal()()?.balanceFormatted || 0;
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
    // Use network-aware address validation with proper error messages
    const errorMessage = this.utilsHelper.getAddressValidationErrorMessage(
      this.walletAddress,
      true,
    );

    if (this.walletAddress && !errorMessage) {
      // Valid address
      this.isAddressValid = true;
      this.addressErrorMessage = '';
    } else {
      // Invalid or empty address
      this.isAddressValid = !this.addressTouched && !this.walletAddress;
      this.addressErrorMessage = this.addressTouched ? errorMessage : '';
    }
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
      // Get the L2 wallet address for the sender
      const l2WalletAddress = currentWallet.getL2WalletAddress();
      if (!l2WalletAddress) {
        this.notificationService.error('Error', 'L2 wallet not available');
        return;
      }

      const l2Provider = currentWallet.getL2Provider();
      if (!l2Provider) {
        this.notificationService.error('Error', 'L2 provider not available');
        return;
      }

      // Convert Kaspa amount to L2 blockchain format (e.g., 1 KAS -> appropriate wei amount)
      const l2Amount = parseUnits(
        String(this.kaspaAmount),
        this.ethereumWalletChainManager.getChainConfig(
          this.ethereumWalletChainManager.getCurrentChainSignal()()!,
        )?.nativeCurrency.decimals || 18,
      );

      // Create EIP1193 action for L2 Kaspa transaction
      const l2TransactionParams = {
        from: l2WalletAddress, // Sender address (L2 address)
        to: this.walletAddress, // Destination address (L2 address)
        value: l2Amount.toString(), // Amount in L2 native currency as string
        gasLimit: '21000', // Standard gas limit for simple transfers
      };

      console.warn('l2TransactionParams', l2TransactionParams);
      const action = this.walletActionService.createEIP1193Action({
        method: EIP1193RequestType.SEND_TRANSACTION,
        params: [l2TransactionParams],
      });

      // Use the existing approval flow and wallet action service
      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(action);

      if (result.success) {
        // Refresh the L2 balance after successful transaction
        await currentWallet.refreshL2Balance();

        this.notificationService.success('Success',
          'L2 Kaspa transaction sent successfully!',
        );
        this.navigateBack();
      } else {
        this.notificationService.error('Error',
          'Failed to send L2 Kaspa transaction',
        );
      }
    } catch (error) {
      console.error('Error sending L2 Kaspa transaction:', error);
      this.notificationService.error('Error', 'Failed to send L2 Kaspa transaction');
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
