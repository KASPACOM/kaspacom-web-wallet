import { Component, computed } from '@angular/core';
import { JsonPipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  WalletAction,
  WalletActionType,
} from '../../../types/wallet-action';
import { WalletService } from '../../../services/wallet.service';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { CompletedActionReview } from '../completed-action-review/completed-action-review.component';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import { PriorityFeeSelectionComponent } from '../priority-fee-selection/priority-fee-selection.component';
import { AppWallet } from '../../../classes/AppWallet';
import { WalletActionResult } from 'kaspacom-wallet-messages';
import { ReviewActionDataService } from '../../../services/review-action-data.service';
import { ActionDisplay } from '../../../types/action-display.type';
import { WalletActionService } from '../../../services/wallet-action.service';

const TIMEOUT = 2 * 60 * 1000;

@Component({
  selector: 'review-action',
  standalone: true,
  templateUrl: './review-action.component.html',
  styleUrls: ['./review-action.component.scss'],
  imports: [NgIf, NgFor, NgClass, SompiToNumberPipe, CompletedActionReview, JsonPipe, PriorityFeeSelectionComponent],
})
export class ReviewActionComponent {
  public WalletActionType = WalletActionType;
  public KRC20OperationType = KRC20OperationType;
  public Number = Number;

  currentActionSignal = computed(() => this.walletActionService.getActionToApproveSignal()());
  currentProgressSignal = computed(() => this.walletActionService.getCurrentProgressSignal()());
  actionResultSignal = computed(() => { console.log(1); return this.walletActionService.getActionResultSignal()() });


  private resolve:
    | ((result: { isApproved: boolean; priorityFee?: bigint }) => void)
    | undefined = undefined;

  private timeout: NodeJS.Timeout | undefined = undefined;

  // Result
  protected currentPriorityFee: bigint | undefined = undefined;

  constructor(private walletService: WalletService, private walletActionService: WalletActionService, private readonly reviewActionDataService: ReviewActionDataService) { }

  requestUserConfirmation(action: WalletAction): Promise<{
    isApproved: boolean;
  }> {
    if (this.resolve) {
      this.resolveActionAndClear(false);
    }

    return this.initAction(action);
  }



  // COMPONENT MANAGEMENT
  private clearData() {
    clearTimeout(this.timeout!);
    this.resolve = undefined;
    this.timeout = undefined;
  }

  private resolveActionAndClear(isApproved: boolean, priorityFee?: bigint) {
    this.currentActionSignal()?.resolve!({ isApproved, priorityFee });
    this.clearData();
  }

  private initAction(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
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
    if (!this.isAvailableForApproval()) {
      return;
    }

    this.resolveActionAndClear(true, this.currentPriorityFee!);
  }

  protected rejectTransaction() {
    this.resolveActionAndClear(false);
  }

  setCurrentPriorityFee(priorityFee: bigint | undefined) {
    console.log('priority fee selected', priorityFee);
    this.currentPriorityFee = priorityFee;
  }

  protected get walletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }

  protected get wallet(): AppWallet {
    return this.walletService.getCurrentWallet()!;
  }

  isAvailableForApproval(): boolean {
    return this.currentPriorityFee !== undefined || !this.isActionHasPriorityFee;
  }

  protected get isActionHasPriorityFee() {
    return this.currentActionSignal && this.currentActionSignal()?.action.type !== WalletActionType.SIGN_MESSAGE;
  }

  protected get currentActionDisplay(): ActionDisplay | undefined {
    if (!this.currentActionSignal) {
      return undefined;
    }

    return this.reviewActionDataService.getActionDisplay(this.currentActionSignal()?.action, this.wallet);
  }
}
