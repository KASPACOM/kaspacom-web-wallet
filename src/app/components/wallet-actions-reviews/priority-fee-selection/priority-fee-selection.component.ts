import {
  Component,
  OnChanges,
  SimpleChanges,
  input,
  output,
  inject,
} from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { AppWallet } from '../../../classes/AppWallet';
import { IFeeEstimate } from '../../../../../public/kaspa/kaspa';
import { FormsModule } from '@angular/forms';
import { Krc20OperationDataService } from '../../../services/protocols/krc20/krc20-operation-data.service';
import { KcNumberInputComponent, KcIconComponent } from '@kaspacom/ui-kit';

type BucketFeeRate = {
  priorityFee: bigint;
  estimatedSeconds: number;
};

type AvailableOption = 'low' | 'normal' | 'priority' | 'custom';

const MINIMUM_FEE_MULTIPLIER = 100n;

@Component({
  selector: 'priority-fee-selection',
  templateUrl: './priority-fee-selection.component.html',
  styleUrls: ['./priority-fee-selection.component.scss'],
  imports: [
    SompiToNumberPipe,
    FormsModule,
    TitleCasePipe,
    CommonModule,
    KcIconComponent,
    KcNumberInputComponent,
  ],
  animations: [
    trigger('slideDown', [
      state(
        'closed',
        style({
          height: '0px',
          opacity: 0,
          overflow: 'hidden',
        }),
      ),
      state(
        'open',
        style({
          height: '*',
          opacity: 1,
          overflow: 'visible',
        }),
      ),
      transition('closed => open', [animate('400ms ease-out')]),
      transition('open => closed', [animate('300ms ease-in')]),
    ]),
  ],
})
export class PriorityFeeSelectionComponent implements OnChanges {
  protected kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  protected krc20OperationsDataService = inject(Krc20OperationDataService);

  readonly action = input.required<WalletAction>();
  readonly wallet = input.required<AppWallet>();
  readonly priorityFeeSelected = output<bigint | undefined>();

  protected minimumFeeMultiplier = MINIMUM_FEE_MULTIPLIER;
  protected totalTransactionsMass: undefined | bigint[] = undefined;
  protected currentFeeRates: undefined | IFeeEstimate = undefined;
  protected transactionMass: undefined | bigint = undefined;
  protected currentOptions:
    | undefined
    | {
        low: BucketFeeRate;
        normal: BucketFeeRate;
        priority: BucketFeeRate;
      } = undefined;

  protected customFee: number = 0;
  protected selectedOption: AvailableOption = 'normal';
  protected additionalPriorityFee: bigint | undefined = undefined;
  protected showPriorityFeeSelection: boolean = false;

  // Methods to determine transaction type and asset info
  getTransactionAssetInfo(): {
    type: 'kaspa' | 'krc20' | 'krc721' | 'kns';
    ticker?: string;
    imageUrl?: string;
  } {
    const action = this.action();
    if (action.type === WalletActionType.TRANSFER_KAS) {
      return { type: 'kaspa' };
    }

    if (action.type === WalletActionType.COMMIT_REVEAL) {
      try {
        const actionScript = action.data.actionScript?.stringifyAction;
        if (actionScript) {
          const parsed = JSON.parse(actionScript);
          if (parsed.p === 'krc-20') {
            return { type: 'krc20', ticker: parsed.tick || 'TOKEN' };
          }
          if (parsed.p === 'krc-721') {
            return { type: 'krc721', imageUrl: parsed.image };
          }
          if (parsed.p === 'kns') {
            return { type: 'kns' };
          }
        }
      } catch (error) {
        console.warn('Failed to parse action script:', error);
      }
    }

    // Default to kaspa for other transaction types
    return { type: 'kaspa' };
  }

  shouldShowAssetIcon(): boolean {
    const assetInfo = this.getTransactionAssetInfo();
    return assetInfo.type !== 'kns'; // Show icons for all except KNS
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    this.totalTransactionsMass = undefined;
    this.feeSelected(undefined);
    await this.loadPriorityFeeDataAndEmit(this.action());
  }

  async loadPriorityFeeDataAndEmit(action: WalletAction) {
    await Promise.all([
      this.kaspaNetworkActionsService
        .estimateWalletActionMass(action, this.wallet())
        .then((result) => {
          this.totalTransactionsMass = result;
        }),
      this.kaspaNetworkActionsService.getEstimateFeeRates().then((result) => {
        this.currentFeeRates = result;
      }),
    ]);

    const maxTransactionMass = Math.max(
      ...this.totalTransactionsMass!.map((m) => Number(m)),
    );

    this.transactionMass = BigInt(maxTransactionMass);

    // Always start with spoiler closed - users can click to expand
    this.showPriorityFeeSelection = false;

    this.currentOptions = {
      low: {
        priorityFee: BigInt(
          Math.round(
            this.currentFeeRates!.lowBuckets[0].feerate * maxTransactionMass,
          ),
        ),

        estimatedSeconds: this.currentFeeRates!.lowBuckets[0].estimatedSeconds,
      },
      normal: {
        priorityFee: BigInt(
          Math.round(
            this.currentFeeRates!.normalBuckets[0].feerate * maxTransactionMass,
          ),
        ),
        estimatedSeconds:
          this.currentFeeRates!.normalBuckets[0].estimatedSeconds,
      },
      priority: {
        priorityFee: BigInt(
          Math.round(
            this.currentFeeRates!.priorityBucket.feerate * maxTransactionMass,
          ),
        ),
        estimatedSeconds: this.currentFeeRates!.priorityBucket.estimatedSeconds,
      },
    };

    this.selectOption(this.selectedOption);
  }

  feeSelected(amount: bigint | undefined) {
    this.additionalPriorityFee =
      amount !== undefined
        ? amount - this.transactionMass! * MINIMUM_FEE_MULTIPLIER < 0n
          ? 0n
          : amount - this.transactionMass! * MINIMUM_FEE_MULTIPLIER
        : undefined;

    this.priorityFeeSelected.emit(this.additionalPriorityFee);
  }

  selectOption(option: AvailableOption | string) {
    this.selectedOption = option as AvailableOption;

    if (
      option !== 'custom' &&
      this.currentOptions &&
      option in this.currentOptions
    ) {
      const fee =
        this.currentOptions[option as keyof typeof this.currentOptions]
          .priorityFee;
      this.feeSelected(fee);
    } else if (option == 'custom') {
      this.feeSelected(
        this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.customFee!),
      );
    }
  }

  getEstimatedTotalFees(): bigint {
    if (
      !this.totalTransactionsMass ||
      this.additionalPriorityFee == undefined
    ) {
      return 0n;
    }

    return (
      this.totalTransactionsMass.reduce((a, b) => a + b, 0n) *
        MINIMUM_FEE_MULTIPLIER +
      this.additionalPriorityFee * BigInt(this.totalTransactionsMass.length) +
      this.getAdditionalCommitActionPrice()
    );
  }

  getAdditionalCommitActionPrice(): bigint {
    const action = this.action();
    if (action.type == WalletActionType.COMMIT_REVEAL) {
      return action.data.options?.revealPriorityFee || 0n;
    }

    return 0n;
  }

  toggleFeeSelection() {
    this.showPriorityFeeSelection = !this.showPriorityFeeSelection;
  }
}
