import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { AddressResolutionResult } from '../../../../../../../../../../services/address-resolution.service';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { DotkService } from '../../../../../../../../../../services/dotk/dotk.service';
import { DotkNameAsset } from '../../../../../../../../../../services/dotk/dotk.types';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-dotk',
  standalone: true,
  imports: [KcButtonComponent, AddressSmartInputComponent],
  templateUrl: './send-dotk.component.html',
  styleUrl: './send-dotk.component.scss',
})
export class SendDotkComponent
  extends FlowPageBaseComponent
  implements OnDestroy
{
  private readonly walletService = inject(WalletService);
  private readonly walletActionService = inject(WalletActionService);
  private readonly dotkService = inject(DotkService);
  private readonly assetsStore =
    inject(AssetsManagerService).getAllAssetStores().l1;
  private readonly notificationService = inject(NotificationService);
  private readonly approvalFlowService = inject(ApprovalFlowService);
  private readonly utils = inject(UtilsHelper);
  private readonly qrScannerService = inject(QrScannerService);
  private readonly router = inject(Router);

  readonly name = signal<DotkNameAsset | undefined>(undefined);
  walletAddress = '';
  resolvedToAddress: string | null = null;
  isAddressValid = true;
  addressErrorMessage = '';
  isLoading = false;
  private waitingForApprovalCompletion = false;

  constructor() {
    super();

    effect(() => {
      const page = this.flowPagesService.activePage();
      if (page?.id === 'send-dotk') {
        this.loadName(page.data?.['name'] as DotkNameAsset | undefined);
      }
    });

    effect(() => {
      const completion = this.approvalFlowService.completion();
      if (!completion || !this.waitingForApprovalCompletion) return;

      this.waitingForApprovalCompletion = false;
      if (completion.success) {
        this.notificationService.success(
          'Success',
          'Dot.K name sent successfully!',
        );
        this.navigateBack();
      }
    });
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-dotk',
      title: `Send ${this.name()?.display || 'Dot.K Name'}`,
      canNavigateBack: true,
    };
  }

  get isFormValid(): boolean {
    return !!this.name() && this.isAddressValid && !!this.effectiveRecipient;
  }

  private get effectiveRecipient(): string | null {
    if (this.resolvedToAddress) return this.resolvedToAddress;
    const trimmed = this.walletAddress.trim();
    return this.utils.isValidWalletAddress(trimmed) ? trimmed : null;
  }

  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
    this.resolvedToAddress = null;
    this.validateAddress();
  }

  onAddressResolved(result: AddressResolutionResult): void {
    if (result.effectiveAddress) {
      this.resolvedToAddress = result.effectiveAddress;
      this.isAddressValid = true;
      this.addressErrorMessage = '';
    } else if (result.error) {
      this.resolvedToAddress = null;
      this.isAddressValid = false;
      this.addressErrorMessage = result.error;
    } else {
      this.resolvedToAddress = null;
      this.validateAddress();
    }
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
      return;
    }

    this.qrScannerService.startScanning({
      scannerId: 'qr-scanner-dotk',
      title: 'Scan Recipient Address',
      onSuccess: (address: string) => {
        this.walletAddress = address;
        this.resolvedToAddress = null;
        this.validateAddress();
      },
      onError: (error: string) => console.error('QR scanning error:', error),
    });
  }

  async onSendClick(): Promise<void> {
    const currentName = this.name();
    const recipient = this.effectiveRecipient;
    const wallet = this.walletService.getCurrentWallet();
    if (!currentName || !recipient || !wallet || !this.isFormValid) return;

    this.isLoading = true;
    try {
      const transfer = await this.dotkService.planTransfer(
        currentName.name,
        recipient,
        wallet,
      );
      const action =
        this.walletActionService.createDotkTransferWalletAction(transfer);
      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(
          action,
          false,
        );

      if (result.success) {
        if (result.isUsingV2Flow) {
          this.waitingForApprovalCompletion = true;
        } else {
          this.notificationService.success(
            'Success',
            'Dot.K name sent successfully!',
          );
          this.navigateBack();
        }
      } else if (result.errorCode !== ERROR_CODES.EIP1193.USER_REJECTED) {
        this.notificationService.error(
          'Error',
          result.errorCode
            ? ERROR_CODES_MESSAGES[result.errorCode]
            : 'Failed to send Dot.K name',
        );
      }
    } catch (error) {
      console.error('Error sending Dot.K name:', error);
      this.notificationService.error(
        'Error',
        error instanceof Error ? error.message : 'Failed to send Dot.K name',
      );
    } finally {
      this.isLoading = false;
    }
  }

  override ngOnDestroy(): void {
    this.qrScannerService.stopScanning();
  }

  protected override navigateBack(): void {
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'dotk' } });
  }

  private loadName(name: DotkNameAsset | undefined): void {
    if (name) {
      this.name.set(name);
      return;
    }

    const nameKey = this.getCurrentConfig()?.data?.['nameKey'];
    if (typeof nameKey === 'string') {
      this.name.set(
        this.assetsStore
          .getAssets(L1_ASSET_KEYS.dotk)
          .find((asset) => asset.name === nameKey),
      );
    }
  }

  private validateAddress(): void {
    if (!this.walletAddress.trim()) {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Address is required';
      return;
    }

    if (this.utils.isValidWalletAddress(this.walletAddress.trim())) {
      this.isAddressValid = true;
      this.addressErrorMessage = '';
      return;
    }

    this.isAddressValid = false;
    this.addressErrorMessage = 'Enter a valid address or resolvable name';
  }
}
