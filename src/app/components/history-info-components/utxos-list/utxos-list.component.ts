import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { UtilsHelper } from '../../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../../services/wallet-action.service';
import { AppWallet } from '../../../classes/AppWallet';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';

@Component({
  selector: 'utxos-list',
  standalone: true,
  templateUrl: './utxos-list.component.html',
  styleUrls: ['./utxos-list.component.scss'],
  imports: [NgIf, NgFor, FormsModule, SompiToNumberPipe],
})
export class UtxosListComponent {
  @Input() wallet!: AppWallet;

  protected selectedToken = '';

  constructor(
    private walletActionService: WalletActionService
  ) {}

  async compoundUtxos() {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createCompoundUtxosAction()
    );
  }

}
