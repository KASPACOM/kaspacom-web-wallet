import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { ImportWalletComponent } from '../../components/import-wallet/import-wallet.component';
import { CreateWalletComponent } from '../../components/create-wallet/create-wallet.component';

@Component({
  selector: 'app-add-wallet',
  standalone: true,
imports: [ImportWalletComponent, CreateWalletComponent, NgIf],
  templateUrl: './add-wallet.component.html',
  styleUrl: './add-wallet.component.scss',
})
export class AddWalletComponent {
  selectedAction: 'create' | 'import' | null = 'create';
}
