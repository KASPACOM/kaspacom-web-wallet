import { NgOptimizedImage } from '@angular/common';
import { Component, OnInit, computed, inject, output } from '@angular/core';
import {
  KcButtonComponent,
  KcIconComponent,
  KcSnackbarComponent,
  NotificationService,
} from 'kaspacom-ui';
import { NewWalletFlowService } from '../../service/new-wallet-flow.service';
import { WalletService } from '../../../../../../../services/wallet.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-address-new-wallet-step',
  imports: [
    KcButtonComponent,
    NgOptimizedImage,
    KcIconComponent,
    KcSnackbarComponent,
  ],
  templateUrl: './address-new-wallet-step.component.html',
  styleUrl: './address-new-wallet-step.component.scss',
})
export class AddressNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly newWalletFlowService = inject(NewWalletFlowService);

  private readonly walletService = inject(WalletService);

  private readonly notificationService = inject(NotificationService);

  private readonly router = inject(Router);

  walletAddress = computed(
    () => this.newWalletFlowService.newWallet().walletAddress,
  );

  displayWalletAddress = computed(() => {
    const address = this.walletAddress();
    const len = 15;
    if (address.length < len) {
      return address;
    }
    return `${address.slice(0, len)}...${address.slice(-4)}`;
  });

  copyAddressToClipboard() {
    navigator.clipboard.writeText(this.walletAddress()).then(
      () => {
        this.notificationService.success(
          'Success',
          'Wallet address copied to clipboard.',
        );
      },
      (error) => {
        console.error('Failed to copy wallet address: ', error);
        this.notificationService.error(
          'Error',
          'Failed to copy wallet address to clipboard.',
        );
      },
    );
  }

  onFinish() {
    this.router.navigate(['/wallet-selection']);
  }
}
