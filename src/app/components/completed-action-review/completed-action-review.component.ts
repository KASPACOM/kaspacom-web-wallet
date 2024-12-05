import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';
import {
  KasTransferActionResult,
  Krc20ActionResult,
  MessageSigningActionResult,
  WalletActionResult,
  WalletActionResultType,
} from '../../types/wallet-action-result';
import { KRC20OperationType } from '../../types/kaspa-network/krc20-operations-data.interface';

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

  get messageSigningResult(): MessageSigningActionResult | undefined {
    return this.actionResult.type === WalletActionResultType.MessageSigning
      ? (this.actionResult as MessageSigningActionResult)
      : undefined;
  }
}
