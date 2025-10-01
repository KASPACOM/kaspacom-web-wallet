import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { WalletService } from '../../../../../services/wallet.service';
import { NetworkSelectionService } from '../../../../../services/network-selection.service';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';

@Component({
  selector: 'app-receive-flow-page',
  imports: [
    CommonModule,
    QRCodeComponent,
    KcButtonComponent,
    KcIconComponent,
    CopyButtonComponent,
    SkeletonComponent,
    CommaFormatterPipe,
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
  private networkSelectionService = inject(NetworkSelectionService);

  // Computed properties for reactive updates
  currentWallet = computed(() => this.walletService.getCurrentWallet());
  currentNetwork = computed(() =>
    this.networkSelectionService.getCurrentNetwork(),
  );

  walletAddress = computed(() => {
    const wallet = this.currentWallet();
    const network = this.currentNetwork();
    if (!wallet) return '';

    if (network === 'l1-kaspa') {
      return wallet.getAddress();
    } else {
      // For L2 networks, get the L2 address
      const l2State = wallet.getL2WalletStateSignal()();
      return l2State?.address || wallet.getAddress(); // fallback to L1
    }
  });

  qrCodeData = computed(() => {
    const network = this.currentNetwork();
    const address = this.walletAddress();

    if (network === 'l1-kaspa') {
      return `kaspa:${address}`;
    } else {
      // For L2 networks, use ethereum: scheme since Kasplex uses 0x addresses
      return `ethereum:${address}`;
    }
  });

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

  onShareWallet(): void {
    if (navigator.share && this.walletAddress()) {
      const network = this.currentNetwork();
      const address = this.walletAddress();

      let shareData: any = {
        title: `My ${network === 'l1-kaspa' ? 'Kaspa' : 'Kasplex'} Wallet Address`,
        text: `Send ${network === 'l1-kaspa' ? 'Kaspa' : 'Kasplex'} to: ${address}`,
      };

      // Use appropriate URL scheme based on network
      if (network === 'l1-kaspa') {
        shareData.url = `kaspa:${address}`;
      } else {
        // For L2 networks, use ethereum: scheme since Kasplex uses 0x addresses
        shareData.url = `ethereum:${address}`;
      }

      navigator.share(shareData).catch((err) => {
        console.log('Error sharing:', err);
        this.fallbackShare();
      });
    } else {
      this.fallbackShare();
    }
  }

  private fallbackShare(): void {
    // Fallback: copy to clipboard
    if (navigator.clipboard && this.walletAddress()) {
      navigator.clipboard.writeText(this.walletAddress());
    }
  }
}
