
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';

@Component({
  selector: 'mempool-transactions',
  templateUrl: './mempool-transactions.component.html',
  styleUrls: ['./mempool-transactions.component.scss'],
  imports: [FormsModule],
})
export class MempoolTransactionsComponent {
  private walletService = inject(WalletService);

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
