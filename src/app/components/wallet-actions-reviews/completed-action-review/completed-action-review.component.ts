import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import {
  BuyKrc20PsktActionResult,
  CompoundUtxosActionResult,
  KasTransferActionResult,
  Krc20ActionResult,
  SignedMessageActionResult,
} from '../../../types/wallet-action-result';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import { PsktTransaction } from '../../../types/kaspa-network/pskt-transaction.interface';
import { WalletActionResult, WalletActionResultType } from 'kaspacom-wallet-messages';

@Component({
  selector: 'completed-action-review',
  standalone: true,
  templateUrl: './completed-action-review.component.html',
  styleUrls: ['./completed-action-review.component.scss'],
  imports: [NgIf, NgFor, SompiToNumberPipe],
})
export class CompletedActionReview {
  public WalletActionResultType = WalletActionResultType;
  public KRC20OperationType = KRC20OperationType;
  public Number = Number;

  @Input() actionResult!: WalletActionResult;

  get kasTransferActionResult(): KasTransferActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.KasTransfer
      ? (this.actionResult as KasTransferActionResult)
      : undefined;
  }

  get krc20ActionResult(): Krc20ActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.Krc20Action
      ? (this.actionResult as Krc20ActionResult)
      : undefined;
  }

  get messageSigningResult(): SignedMessageActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.MessageSigning
      ? (this.actionResult as SignedMessageActionResult)
      : undefined;
  }

  get compoundUtxosActionResult(): CompoundUtxosActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.CompoundUtxos
      ? (this.actionResult as CompoundUtxosActionResult)
      : undefined;
  }

  get buyKrc20PsktActionResult(): BuyKrc20PsktActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.BuyKrc20Pskt
      ? (this.actionResult as BuyKrc20PsktActionResult)
      : undefined;
  }

  get buyKrc20PsktActionResultAmount(): bigint | undefined {
    if (!this.buyKrc20PsktActionResult) {
      return undefined;
    }
    
    const transactionData: PsktTransaction = JSON.parse(this.buyKrc20PsktActionResult.psktTransactionJson);

    return transactionData.outputs.reduce((acc, output) => acc + BigInt(output.value), BigInt(0));
  }
}
