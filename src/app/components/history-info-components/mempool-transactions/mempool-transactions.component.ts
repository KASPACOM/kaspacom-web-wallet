import { Component, computed, Input } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletService } from '../../../services/wallet.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { PendingTransaction, Transaction } from '../../../../../public/kaspa/kaspa';


@Component({
  selector: 'mempool-transactions',
  standalone: true,
  templateUrl: './mempool-transactions.component.html',
  styleUrls: ['./mempool-transactions.component.scss'],
  imports: [NgIf, NgFor, FormsModule, SompiToNumberPipe, CommonModule],
})
export class MempoolTransactionsComponent {
  constructor(private walletService: WalletService,
  ) { }
  mempoolTransactions = computed(() => this.walletService.getCurrentWallet()!.getMempoolTransactionsSignalValue());


  hasMempoolTransactions() {
    if (!this.mempoolTransactions()) {
      return false;
    }

    return this.mempoolTransactions()!.receiving.length > 0 || this.mempoolTransactions()!.sending.length > 0;
  }
}
