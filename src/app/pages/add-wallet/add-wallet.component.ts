import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportWalletComponent } from '../../components/wallet-management/import-wallet/import-wallet.component';
import { CreateWalletComponent } from '../../components/wallet-management/create-wallet/create-wallet.component';

@Component({
  selector: 'app-add-wallet',
  standalone: true,
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
}
