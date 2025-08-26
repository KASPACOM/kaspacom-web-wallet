import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { KcButtonComponent } from '@kaspacom/ui';
import { WalletService } from '../../../../../../../services/wallet.service';
import { FlowPagesService } from '../../../../../../services/flow-pages.service';

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
  private readonly flowPagesService = inject(FlowPagesService);

  async finish() {
    await this.walletService.loadWallets();
    const all = this.walletService.getAllWallets()() || [];
    if (all.length > 0) {
      const byId = new Map<number, string>();
      all.forEach((w) => {
        const id = w.getId();
        if (!byId.has(id)) {
          byId.set(id, w.getIdWithAccount());
        }
      });
      const maxId = Math.max(...Array.from(byId.keys()));
      const selectIdWithAccount = byId.get(maxId)!;
      await this.walletService.selectCurrentWallet(selectIdWithAccount);
    } else {
      await this.walletService.selectCurrentWalletFromLocalStorageNullsafe();
    }
    // Ensure any flow overlays are closed
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home']);
  }
}
