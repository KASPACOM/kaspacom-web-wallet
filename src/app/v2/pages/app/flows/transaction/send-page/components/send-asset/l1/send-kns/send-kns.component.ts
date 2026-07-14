import {
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ERROR_CODES, ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { firstValueFrom } from 'rxjs';
import { AddressResolutionResult } from '../../../../../../../../../../services/address-resolution.service';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import {
  KnsDomainAsset,
  KnsWalletAssetsStatus,
} from '../../../../../../../../../../services/kns-api/dtos/kns-domain.dto';
import { KnsApiService } from '../../../../../../../../../../services/kns-api/kns-api.service';
import { KnsWalletActionService } from '../../../../../../../../../../services/protocols/kns/kns-wallet-actions.service';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CheckboxInputComponent } from '../../../../../../../../../shared/ui/input/checkbox/checkbox-input/checkbox-input.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-kns',
  standalone: true,
  imports: [
    CheckboxInputComponent,
    KcButtonComponent,
    FormsModule,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-kns.component.html',
  styleUrl: './send-kns.component.scss',
})
export class SendKnsComponent
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy
{
  private walletService = inject(WalletService);
  private knsService = inject(KnsApiService);
  private assetsManagerService = inject(AssetsManagerService);
  private walletActionService = inject(WalletActionService);
  private knsWalletActionService = inject(KnsWalletActionService);
  private notificationService = inject(NotificationService);
  private approvalFlowService = inject(ApprovalFlowService);
  private utilsHelper = inject(UtilsHelper);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);

  domain = signal<KnsDomainAsset | undefined>(undefined);
  loading = signal<boolean>(true);
  walletAddress = '';
  replaceByFee = false;

  // Loading state
  isLoading = false;

  // Track if we're waiting for approval flow completion
  private waitingForApprovalCompletion = false;

  // Validation states
  isAddressValid = true;
  addressErrorMessage = '';

  constructor() {
    super();

    // Effect to watch for approval flow completion
    effect(() => {
      const completion = this.approvalFlowService.completion();
      if (completion && this.waitingForApprovalCompletion) {
        this.waitingForApprovalCompletion = false;

        if (completion.success) {
          // Transaction was successful, navigate back
          this.notificationService.success('Success', 'KNS domain sent successfully!');
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });

    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-kns') {
        this.loadDomainData();
      }
    });
  }

  override ngOnInit() {
    // Remove effects from here since they're now in constructor
  }

  override ngOnDestroy() {
    // Clean up QR scanner when component is destroyed
    this.qrScannerService.stopScanning();
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-kns',
      title: `Send ${this.domain()?.asset || 'Domain'}`,
      canNavigateBack: true,
    };
  }

  get isFormValid(): boolean {
    return (
      this.walletAddress.trim().length > 0 &&
      this.isAddressValid &&
      !this.isListed()
    );
  }

  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
    this.validateAddress();
  }

  onAddressResolved(result: AddressResolutionResult): void {
    if (result.effectiveAddress) {
      this.walletAddress = result.effectiveAddress;
      this.isAddressValid = true;
      this.addressErrorMessage = '';
    } else if (result.source === 'kns' && result.error) {
      this.isAddressValid = false;
      this.addressErrorMessage = result.error;
    } else {
      this.validateAddress();
    }
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-kns',
        title: 'Scan KNS Address',
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
    if (!this.walletAddress.trim()) {
      this.isAddressValid = false;
      this.addressErrorMessage = 'Address is required';
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

  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }

  async onSendClick(): Promise<void> {
    if (!this.isFormValid || !this.domain()) {
      return;
    }

    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.notificationService.error('Error', 'No wallet selected');
      return;
    }

    const currentDomain = this.domain()!;
    if (!currentDomain.asset) {
      this.notificationService.error('Error', 'Invalid domain data');
      return;
    }

    this.isLoading = true;

    try {
      // Create KNS transfer action
      const action = this.knsWalletActionService.createTransferWalletAction(
        currentDomain.assetId, // asset ID
        currentDomain.isDomain, // whether it's a domain
        this.walletAddress, // to address
      );

      console.log('KNS Transfer Action:', action, currentWallet, currentDomain);

      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(
          action,
          false,
        );

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.replaceByFee = false;

        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.notificationService.success('Success', 'KNS domain sent successfully!');
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
      console.error('Error sending KNS domain:', error);
      this.notificationService.error('Error', 'Failed to send KNS domain');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadDomainData(): Promise<void> {
    try {
      this.loading.set(true);

      // Clear form data when loading new domain
      this.walletAddress = '';
      this.replaceByFee = false;

      // Get navigation data - should contain the full domain object
      const navigationData = this.getNavigationData();
      const domainData = navigationData?.domain as KnsDomainAsset;

      if (domainData) {
        // Use domain data from navigation (which comes from assets store)
        this.domain.set(domainData);
      } else if (navigationData?.assetId) {
        // Fallback: try to find domain in assets store
        const knsAssets = this.assetsManagerService
          .getAllAssetStores()
          .l1.getAssets(L1_ASSET_KEYS.kns);
        const storedDomain = knsAssets.find(
          (domain) => domain.assetId === navigationData.assetId,
        );

        if (storedDomain) {
          this.domain.set(storedDomain);
        } else {
          // Final fallback: load from API
          const response = await firstValueFrom(
            this.knsService.fetchAssetByAssetId(navigationData.assetId),
          );

          if (response.data) {
            this.domain.set(response.data);
          }
        }
      } else {
        console.warn('No domain data provided in navigation');
      }
    } catch (error) {
      console.error('Failed to load KNS domain data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private getNavigationData(): any {
    // Get data from current page configuration
    const currentPage = this.getCurrentConfig();
    return currentPage?.data || {};
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  getDomainType(): string {
    const currentDomain = this.domain();
    return currentDomain?.isDomain ? 'DOM' : 'TXT';
  }

  getDomainTypeLabel(): string {
    const currentDomain = this.domain();
    return currentDomain?.isDomain ? 'Domain' : 'Text Record';
  }

  getDisplayName(): string {
    const currentDomain = this.domain();
    return currentDomain?.asset || 'KNS Domain';
  }

  getStatus(): string {
    const currentDomain = this.domain();
    return currentDomain?.status || 'Unknown';
  }

  isListed(): boolean {
    return (
      this.domain()?.status?.toLowerCase() === KnsWalletAssetsStatus.LISTED
    );
  }

  isVerified(): boolean {
    const currentDomain = this.domain();
    return currentDomain?.isVerifiedDomain || false;
  }

  /**
   * Override navigateBack to navigate to homepage with KNS tab selected
   */
  protected override navigateBack(): void {
    // Close the flow and navigate to homepage with KNS tab
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'kns' } });
  }
}
