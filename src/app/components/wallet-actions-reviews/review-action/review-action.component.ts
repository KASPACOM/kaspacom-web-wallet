import { Component, computed, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  SignPsktTransactionAction,
  WalletAction,
  WalletActionType,
} from '../../../types/wallet-action';
import { WalletService } from '../../../services/wallet.service';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import { PriorityFeeSelectionComponent } from '../priority-fee-selection/priority-fee-selection.component';
import { AppWallet } from '../../../classes/AppWallet';
import { ReviewActionDataService } from '../../../services/action-info-services/review-action-data.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import {
  EIP1193RequestPayload,
  EIP1193RequestType,
} from '@kaspacom/wallet-messages';
import { InputFieldType } from '../../../types/action-display.type';
import { KcButtonComponent } from '@kaspacom/ui-kit';
import { CheckboxInputComponent } from '../../../v2/shared/ui/input/checkbox/checkbox-input/checkbox-input.component';

const TIMEOUT = 2 * 60 * 1000;

@Component({
  selector: 'review-action',
  templateUrl: './review-action.component.html',
  styleUrls: ['./review-action.component.scss'],
  imports: [
    PriorityFeeSelectionComponent,
    FormsModule,
    KcButtonComponent,
    CheckboxInputComponent,
  ],
})
export class ReviewActionComponent {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private readonly reviewActionDataService = inject(ReviewActionDataService);

  public WalletActionType = WalletActionType;
  public KRC20OperationType = KRC20OperationType;
  public InputFieldType = InputFieldType;
  public Number = Number;

  currentActionDisplay = computed(() =>
    this.currentActionSignal
      ? this.reviewActionDataService.getActionDisplay(
          this.currentActionSignal()?.action,
          this.wallet,
        )
      : undefined,
  );
  currentActionSignal = computed(() =>
    this.walletActionService.getActionToApproveSignal()(),
  );
  currentProgressSignal = computed(() =>
    this.walletActionService.getCurrentProgressSignal()(),
  );
  actionResultSignal = computed(() =>
    this.walletActionService.getActionResultSignal()(),
  );

  private resolve:
    | ((result: { isApproved: boolean; priorityFee?: bigint }) => void)
    | undefined = undefined;

  private timeout: NodeJS.Timeout | undefined = undefined;

  // Result
  protected currentPriorityFee: bigint | undefined = undefined;
  protected additionalParams: { [key: string]: any } = {};

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

  private resolveActionAndClear(isApproved: boolean) {
    this.walletActionService.resolveCurrentWaitingForApproveAction(
      isApproved,
      isApproved ? this.currentPriorityFee! : undefined,
      isApproved ? this.additionalParams : undefined,
    );
    this.clearData();
  }

  private initAction(action: WalletAction): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
  }> {
    this.additionalParams = {};
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

    this.resolveActionAndClear(true);
  }

  protected rejectTransaction() {
    this.resolveActionAndClear(false);
  }

  setCurrentPriorityFee(priorityFee: bigint | undefined) {
    this.currentPriorityFee = priorityFee;
  }

  protected get walletAddress(): string {
    return this.walletService.getCurrentWallet()?.getAddress() || '';
  }

  protected get wallet(): AppWallet {
    return this.walletService.getCurrentWallet()!;
  }

  isAvailableForApproval(): boolean {
    return (
      this.currentPriorityFee !== undefined || !this.isActionHasPriorityFee
    );
  }

  protected get isActionHasPriorityFee() {
    if (!(this.currentActionSignal && this.currentActionSignal())) {
      return false;
    }

    if (
      [
        WalletActionType.SIGN_MESSAGE,
        WalletActionType.APPROVE_COMMUNICATION_APP,
      ].includes(this.currentActionSignal()!.action.type)
    ) {
      return false;
    }

    if (
      this.currentActionSignal()!.action.type ===
      WalletActionType.EIP1193_PROVIDER_REQUEST
    ) {
      const actionData = this.currentActionSignal()!.action
        .data as EIP1193RequestPayload<EIP1193RequestType>;

      if (actionData.method != EIP1193RequestType.KAS_SEND_TRANSACTION) {
        return false;
      }
    }

    if (
      this.currentActionSignal()!.action.type ===
        WalletActionType.SIGN_PSKT_TRANSACTION &&
      (this.currentActionSignal()!.action.data as SignPsktTransactionAction)
        .signOnly
    ) {
      return false;
    }

    return true;
  }
}
