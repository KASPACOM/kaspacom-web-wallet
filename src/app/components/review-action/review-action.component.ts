import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { TransferKasAction, WalletAction, WalletActionType } from '../../types/wallet-action';
import { WalletService } from '../../services/wallet.service';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';

const TIMEOUT = 2 * 60 * 1000;

@Component({
  selector: 'review-action',
  standalone: true,
  templateUrl: './review-action.component.html',
  styleUrls: ['./review-action.component.scss'],
  imports: [NgIf, NgFor, SompiToNumberPipe],
})
export class ReviewActionComponent {
  public WalletActionType = WalletActionType;

  private resolve:
    | ((result: { isApproved: boolean; priorityFee?: bigint }) => void)
    | undefined = undefined;

  protected action: WalletAction | undefined = undefined;
  private timeout: NodeJS.Timeout | undefined = undefined;

  constructor(private walletService: WalletService) {}

  public requestUserConfirmation(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    if (this.resolve) {
      this.resolveActionAndClear(false);
    }

    return this.initAction(action);
  }

  private clearData() {
    this.resolve = undefined;
    this.action = undefined;
  }

  private resolveActionAndClear(isApproved: boolean, priorityFee?: bigint) {
    this.resolve!({ isApproved, priorityFee });
    this.clearData();
  }

  private initAction(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    this.action = action;
    this.timeout = setTimeout(() => {
      this.resolveActionAndClear(false);
    }, TIMEOUT);

    return new Promise<{
      isApproved: boolean;
      priorityFee?: bigint;
    }>((res) => {
      this.resolve = res;
    });
  }

  protected acceptTransaction() {
    this.resolveActionAndClear(true, 0n);
  }

  protected rejectTransaction() {
    this.resolveActionAndClear(false);
  }

  protected get transferKasActionData(): TransferKasAction {
    return this.action?.data as TransferKasAction;
  }

  protected get walletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }
}
