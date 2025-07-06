import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { KcButtonComponent } from 'kaspacom-ui';
import { WalletService } from '../../../../../../../services/wallet.service';

@Component({
  selector: 'app-success-import-existing-step',
  imports: [CommonModule, KcButtonComponent, NgOptimizedImage],
  templateUrl: './success-import-existing-step.component.html',
  styleUrl: './success-import-existing-step.component.scss',
})
export class SuccessImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly walletService: WalletService = inject(WalletService);

  private readonly router = inject(Router);

  async finish() {
    await this.walletService.selectCurrentWalletFromLocalStorageNullsafe();
    this.router.navigate(['/app/home']);
  }
}
