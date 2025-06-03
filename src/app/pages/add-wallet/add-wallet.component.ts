import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ImportWalletComponent } from '../../components/wallet-management/import-wallet/import-wallet.component';
import { CreateWalletComponent } from '../../components/wallet-management/create-wallet/create-wallet.component';
import { WalletService } from '../../services/wallet.service';

@Component({
    selector: 'app-add-wallet',
    imports: [
        CommonModule,
        ImportWalletComponent,
        CreateWalletComponent
    ],
    templateUrl: './add-wallet.component.html',
    styleUrl: './add-wallet.component.scss'
})
export class AddWalletComponent {
  selectedAction: 'create' | 'import' = 'create';
  hasExistingWallets = false;

  constructor(
    private walletService: WalletService,
    private router: Router
  ) {
    this.hasExistingWallets = this.walletService.getWalletsCount() > 0;
  }

  goBack() {
    this.router.navigate(['/wallet-selection']);
  }
}
