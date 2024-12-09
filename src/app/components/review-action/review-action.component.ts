import { Component } from '@angular/core';
import { JsonPipe, NgFor, NgIf } from '@angular/common';
import { Krc20Action, TransferKasAction, WalletAction, WalletActionType } from '../../types/wallet-action';
import { WalletService } from '../../services/wallet.service';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';
import { WalletActionResult } from '../../types/wallet-action-result';
import { CompletedActionReview } from '../completed-action-review/completed-action-review.component';
import { KRC20OperationType } from '../../types/kaspa-network/krc20-operations-data.interface';

const TIMEOUT = 2 * 60 * 1000;

@Component({
  selector: 'review-action',
  standalone: true,
  templateUrl: './review-action.component.html',
  styleUrls: ['./review-action.component.scss'],
  imports: [NgIf, NgFor, SompiToNumberPipe, CompletedActionReview, JsonPipe],
})
export class ReviewActionComponent {
  public WalletActionType = WalletActionType;
  public KRC20OperationType = KRC20OperationType;

  private resolve:
    | ((result: { isApproved: boolean; priorityFee?: bigint }) => void)
    | undefined = undefined;

  protected action: WalletAction | undefined = undefined;
  private timeout: NodeJS.Timeout | undefined = undefined;

  // LOADER
  protected showLoader: boolean = false;
  protected progress: number | undefined = undefined;

  // Result
  protected result: WalletActionResult | undefined = undefined;


  constructor(private walletService: WalletService) {}


  // PUBLIC ACTIONS
  public requestUserConfirmation(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    if (this.resolve) {
      this.resolveActionAndClear(false);
    }

    return this.initAction(action);
  }

  public showActionLoader(progress?: number | undefined) { 
    this.showLoader = true;
    this.progress = progress;
  }

  public hideActionLoader() {
    this.showLoader = false;
    this.progress = undefined;
  }

  public setActionResult(result: WalletActionResult) {
    this.result = result;
  }


  // COMPONENT MANAGEMENT
  private clearData() {
    clearTimeout(this.timeout!);
    this.resolve = undefined;
    this.action = undefined;
    this.result = undefined;
    this.timeout = undefined;
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

  protected get krc20ActionData(): Krc20Action {
    return this.action?.data as Krc20Action;
  }

  protected get walletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }
  
}
