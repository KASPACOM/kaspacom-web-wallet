
import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { WalletService } from '../../../../../services/wallet.service';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-receive-flow-page',
  imports: [
    QRCodeComponent,
    CopyButtonComponent,
    SkeletonComponent
],
  templateUrl: './receive-flow-page.component.html',
  styleUrl: './receive-flow-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class ReceiveFlowPageComponent implements OnInit, OnDestroy {
  private walletService = inject(WalletService);

  // Computed properties for reactive updates
  currentWallet = computed(() => this.walletService.getCurrentWallet());

  walletAddress = this.walletService.getCurrentDisplayWalletAddressAsString;

  walletName = computed(
    () => this.currentWallet()?.getDisplayName() || 'Wallet',
  );

  // Loading state
  isLoading = computed(() => !this.currentWallet());

  // QR code settings
  qrCodeSize = 256;

  ngOnInit(): void {
    this.updateQrCodeSize();
    window.addEventListener('resize', this.updateQrCodeSize.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.updateQrCodeSize.bind(this));
  }

  private updateQrCodeSize(): void {
    // Responsive QR code size
    const width = window.innerWidth;
    if (width <= 480) {
      this.qrCodeSize = 200;
    } else if (width <= 768) {
      this.qrCodeSize = 240;
    } else {
      this.qrCodeSize = 280;
    }
  }
}
