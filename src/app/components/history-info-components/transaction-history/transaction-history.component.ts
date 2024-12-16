import { Component, effect, Input } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import {
  FullTransactionResponse,
  FullTransactionResponseItem,
} from '../../../services/kaspa-api/dtos/full-transaction-response.dto';
import { AppWallet } from '../../../classes/AppWallet';

type MappedTransaction = {
  id: string;
  senders: Record<string, bigint>;
  receivers: Record<string, bigint>;
  totalForThisWallet: bigint;
  date: Date;
  confirmed: boolean;
  fee: bigint;
};

@Component({
  selector: 'transaction-history',
  standalone: true,
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss'],
  imports: [NgIf, NgFor, FormsModule, SompiToNumberPipe, CommonModule],
})
export class TransactionHistoryComponent {
  @Input() transactions: undefined | FullTransactionResponse;
  @Input() wallet!: AppWallet;

  protected kaspaTransactionsHistoryMapped: undefined | MappedTransaction[] =
    undefined;

  constructor() {
    effect(() => {
      if (this.transactions) {
        this.kaspaTransactionsHistoryMapped = this.transactions.map((tx) =>
          this.transformTransactionData(tx)
        );
      }
    });
  }

  transformTransactionData(
    transaction: FullTransactionResponseItem
  ): MappedTransaction {
    const senders = transaction.inputs.reduce((acc, input) => {
      const address = input.previous_outpoint_address;
      if (!acc[address]) {
        acc[address] = BigInt(0);
      }
      acc[address] += BigInt(input.previous_outpoint_amount);
      return acc;
    }, {} as Record<string, bigint>);

    const receivers = transaction.outputs.reduce((acc, output) => {
      const address = output.script_public_key_address;
      if (!acc[address]) {
        acc[address] = BigInt(0);
      }
      acc[address] += BigInt(output.amount);
      return acc;
    }, {} as Record<string, bigint>);

    const fee = Object.values(senders).reduce((acc, val) => acc + val, 0n) -
      Object.values(receivers).reduce((acc, val) => acc + val, 0n);

    const totalForThisWallet =
      (receivers[this.wallet!.getAddress()] || BigInt(0)) -
      (senders[this.wallet!.getAddress()] || BigInt(0));

    delete senders[this.wallet!.getAddress()];
    delete receivers[this.wallet!.getAddress()];

    const walletsInBoth = Object.keys(senders).filter(
      (address) => !!receivers[address]
    );

    for (const address of walletsInBoth) {
      senders[address] = senders[address] - receivers[address];
      delete receivers[address];
    }

    return {
      id: transaction.transaction_id,
      senders,
      receivers,
      totalForThisWallet,
      date: new Date(transaction.block_time),
      confirmed: transaction.is_accepted,
      fee,
    };
  }
}
