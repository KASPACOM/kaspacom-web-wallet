import { Component, Input } from '@angular/core';

import { UtilsHelper } from '../../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { WalletActionService } from '../../../services/wallet-action.service';
import { AppWallet } from '../../../classes/AppWallet';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';

@Component({
  selector: 'utxos-list',
  templateUrl: './utxos-list.component.html',
  styleUrls: ['./utxos-list.component.scss'],
  imports: [FormsModule, SompiToNumberPipe],
})
export class UtxosListComponent {
  @Input() wallet!: AppWallet;

  protected selectedToken = '';

  constructor(private walletActionService: WalletActionService) {}

  async compoundUtxos() {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createCompoundUtxosAction(),
    );
  }
}
