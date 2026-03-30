import { CommonModule, NgIf } from '@angular/common';
import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';

@Component({
  selector: 'mempool-transactions',
  templateUrl: './mempool-transactions.component.html',
  styleUrls: ['./mempool-transactions.component.scss'],
  imports: [NgIf, FormsModule, CommonModule],
})
export class MempoolTransactionsComponent {
  constructor(private walletService: WalletService) {}
  mempoolTransactions = computed(() =>
    this.walletService.getCurrentWallet()!.getMempoolTransactionsSignalValue(),
  );

  hasMempoolTransactions() {
    if (!this.mempoolTransactions()) {
      return false;
    }

    return (
      this.mempoolTransactions()!.receiving.length > 0 ||
      this.mempoolTransactions()!.sending.length > 0
    );
  }
}
