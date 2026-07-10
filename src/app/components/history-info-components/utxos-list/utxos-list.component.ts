import { Component, Input, inject } from '@angular/core';

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
  private walletActionService = inject(WalletActionService);

  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
  @Input() wallet!: AppWallet;

  protected selectedToken = '';

  async compoundUtxos() {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createCompoundUtxosAction(),
    );
  }
}
