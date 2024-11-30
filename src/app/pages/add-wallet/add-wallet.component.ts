import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { ImportWalletComponent } from '../../components/import-wallet/import-wallet.component';

@Component({
  selector: 'app-add-wallet',
  standalone: true,
  imports: [ImportWalletComponent, NgIf],
  templateUrl: './add-wallet.component.html',
  styleUrl: './add-wallet.component.scss',
})
export class AddWalletComponent {
  selectedAction: 'add' | 'import' | null = 'import';
}
