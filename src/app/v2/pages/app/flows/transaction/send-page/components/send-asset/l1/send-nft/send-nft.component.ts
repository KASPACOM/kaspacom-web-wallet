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
import { KcButtonComponent, KcCheckboxComponent } from 'kaspacom-ui';
import { firstValueFrom } from 'rxjs';
import { AddressResolutionResult } from '../../../../../../../../../../services/address-resolution.service';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { KaspaL1NetworkService } from '../../../../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { Krc721ApiService } from '../../../../../../../../../../services/krc721-api/krc721-api.service';
import { MessagePopupService } from '../../../../../../../../../../services/message-popup.service';
import { Krc721WalletActionService } from '../../../../../../../../../../services/protocols/krc721/krc721-wallet-actions.service';
import { QrScannerService } from '../../../../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import { WalletActionService } from '../../../../../../../../../../services/wallet-action.service';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { ApprovalFlowService } from '../../../../../../../../../services/approval-flow.service';
import { AddressSmartInputComponent } from '../../../../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { INft } from '../../../../../../../common/interfaces/nft.interface';

@Component({
  selector: 'app-send-nft',
  standalone: true,
  imports: [
    KcCheckboxComponent,
    KcButtonComponent,
    FormsModule,
    SkeletonComponent,
    AddressSmartInputComponent,
  ],
  templateUrl: './send-nft.component.html',
  styleUrl: './send-nft.component.scss',
})
export class SendNftComponent
  extends FlowPageBaseComponent
  implements OnInit, OnDestroy
{
  private walletService = inject(WalletService);
  private krc721Service = inject(Krc721ApiService);
  private walletActionService = inject(WalletActionService);
  private krc721WalletActionService = inject(Krc721WalletActionService);
  private messagePopupService = inject(MessagePopupService);
  private approvalFlowService = inject(ApprovalFlowService);
  private utilsHelper = inject(UtilsHelper);
  private qrScannerService = inject(QrScannerService);
  private router = inject(Router);
  private assetsManagerService = inject(AssetsManagerService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  nft = signal<INft | undefined>(undefined);
  loading = signal<boolean>(true);
  walletAddress = '';
  replaceByFee = false;

  // Use resolved address if domain detected
  private resolvedToAddress: string | null = null;

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
          this.messagePopupService.showSuccess('NFT sent successfully!');
          this.navigateBack();
        }
        // Error cases are handled by the approval flow itself
      }
    });

    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-nft') {
        this.loadNftData();
      }
    });
  }

  override ngOnDestroy() {
    // Clean up QR scanner when component is destroyed
    this.qrScannerService.stopScanning();
  }

  get config(): IFlowPageConfig {
    return {
      id: 'send-nft',
      title: `Send ${this.nft()?.name || 'NFT'}`,
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
    // Do not overwrite the input value; keep any domain text
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

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-nft',
        title: 'Scan NFT Address',
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

  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }

  async onSendClick(): Promise<void> {
    if (!this.isFormValid || !this.nft()) {
      return;
    }

    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.messagePopupService.showError('No wallet selected');
      return;
    }

    const currentNft = this.nft()!;
    if (this.isListed()) {
      this.messagePopupService.showError(
        'Cancel the listing before sending this NFT.',
      );
      return;
    }

    if (!currentNft.tick || !currentNft.tokenId) {
      this.messagePopupService.showError('Invalid NFT data');
      return;
    }

    this.isLoading = true;

    try {
      // Create KRC721 transfer action
      const toAddress = this.resolvedToAddress || this.walletAddress;
      const action = this.krc721WalletActionService.createTransferWalletAction(
        currentNft.tick.toLowerCase(), // ticker (lowercase)
        currentNft.tokenId, // tokenId
        toAddress, // to address
      );

      console.log('KRC721 Transfer Action:', action, currentWallet, currentNft);

      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(
          action,
          false,
        );

      if (result.success) {
        // Clear form on success
        this.walletAddress = '';
        this.replaceByFee = false;
        this.resolvedToAddress = null;

        // Only show success message and navigate if not using v2 flow
        // v2 flow handles success display in the approval flow
        if (!result.isUsingV2Flow) {
          this.messagePopupService.showSuccess('NFT sent successfully!');
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
      console.error('Error sending NFT:', error);
      this.messagePopupService.showError('Failed to send NFT');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadNftData(): Promise<void> {
    try {
      this.loading.set(true);

      // Clear form data when loading new NFT
      this.walletAddress = '';
      this.replaceByFee = false;
      this.resolvedToAddress = null;

      // Get navigation data - should contain the full NFT object
      const navigationData = this.getNavigationData();
      const nftData = navigationData?.nft as INft;

      if (nftData) {
        // Use NFT data from navigation (which comes from assets store)
        this.nft.set({
          ...nftData,
          isListed:
            nftData.isListed ??
            this.findStoredNft(nftData.tick, nftData.tokenId)?.isListed,
        });
      } else if (navigationData?.tick && navigationData?.tokenId) {
        // Fallback: try to find NFT in assets store
        const storedNft = this.findStoredNft(
          navigationData.tick,
          navigationData.tokenId,
        );

        if (storedNft) {
          const nft: INft = {
            tick: storedNft.tick,
            tokenId: storedNft.tokenId,
            owner: storedNft.owner,
            name: storedNft.metadata?.name,
            description: storedNft.metadata?.description,
            attributes: storedNft.metadata?.attributes,
            isListed: storedNft.isListed,
            image:
              this.buildCachedImageUrl(storedNft.tick, storedNft.tokenId) ||
              this.processImageUrl(storedNft.metadata?.image),
          };
          this.nft.set(nft);
        } else {
          // Final fallback: create basic NFT and load metadata
          const currentWallet = this.walletService.getCurrentWallet();
          if (!currentWallet) {
            console.warn('No current wallet selected');
            return;
          }

          const basicNft: INft = {
            tick: navigationData.tick,
            tokenId: navigationData.tokenId,
            owner: currentWallet.getAddress(),
            name: undefined,
            description: undefined,
            attributes: undefined,
            image: undefined,
          };

          this.nft.set(basicNft);
          await this.loadNftMetadata(basicNft);
        }
      } else {
        console.warn('No NFT data provided in navigation');
      }
    } catch (error) {
      console.error('Failed to load NFT data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadNftMetadata(nft: INft): Promise<void> {
    try {
      const metadata = await firstValueFrom(
        this.krc721Service.getNftMetadata(nft.tick, nft.tokenId),
      );

      if (metadata) {
        const updatedNft: INft = {
          ...nft,
          name: metadata.name,
          description: metadata.description,
          attributes: metadata.attributes,
          isListed: nft.isListed,
          image:
            this.buildCachedImageUrl(nft.tick, nft.tokenId) ||
            this.processImageUrl(metadata.image),
        };

        this.nft.set(updatedNft);
      }
    } catch (error) {
      console.error('Failed to load NFT metadata:', error);
    }
  }

  private getNavigationData(): any {
    // Get data from current page configuration
    const currentPage = this.getCurrentConfig();
    return currentPage?.data || {};
  }

  private processImageUrl(imageUrl?: string): string | undefined {
    if (!imageUrl) return undefined;

    // Convert IPFS URLs to HTTP
    if (imageUrl.startsWith('ipfs://')) {
      return imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    return imageUrl;
  }

  private findStoredNft(tick?: string, tokenId?: string) {
    if (!tick || !tokenId) {
      return undefined;
    }

    return this.assetsManagerService
      .getAllAssetStores()
      .l1.getAssets(L1_ASSET_KEYS.krc721)
      .find(
        (nft) =>
          nft.tick.toUpperCase() === tick.toUpperCase() &&
          nft.tokenId.toString() === tokenId.toString(),
      );
  }

  // Helper method to get display name
  getDisplayName(): string {
    const currentNft = this.nft();
    if (currentNft?.name) {
      return currentNft.name;
    }
    return `${currentNft?.tick?.toUpperCase()} #${currentNft?.tokenId}`;
  }

  // Helper method to get image URL
  getImageUrl(): string {
    const currentNft = this.nft();
    if (currentNft) {
      const cachedImageUrl = this.buildCachedImageUrl(
        currentNft.tick,
        currentNft.tokenId,
      );
      if (cachedImageUrl) {
        return cachedImageUrl;
      }

      const fallbackImage = currentNft.image;
      if (fallbackImage) {
        if (fallbackImage.startsWith('ipfs://')) {
          return fallbackImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }
        return fallbackImage;
      }
    }
    return '';
  }

  isListed(): boolean {
    return this.nft()?.isListed === true;
  }

  onImageError(event: Event): void {
    // Hide the image on error and let the placeholder show
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  }

  /**
   * Override navigateBack to navigate to homepage with KRC721 tab selected
   */
  protected override navigateBack(): void {
    // Close the flow and navigate to homepage with KRC721 tab
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'krc721' } });
  }

  private buildCachedImageUrl(tick?: string, tokenId?: string): string {
    const cacheStreamUrl = this.kaspaL1NetworkService.getKrc721CacheStreamUrl();
    if (!tick || !tokenId || !cacheStreamUrl) {
      return '';
    }

    const normalizedTick = encodeURIComponent(tick.toUpperCase());
    const normalizedTokenId = encodeURIComponent(tokenId);
    return `${cacheStreamUrl}/optimized/${normalizedTick}/${normalizedTokenId}`;
  }
}
