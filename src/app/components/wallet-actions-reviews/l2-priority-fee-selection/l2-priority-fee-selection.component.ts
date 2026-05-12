import {
  Component,
  computed,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {
  CommonModule,
  NgIf,
} from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { WalletAction } from '../../../types/wallet-action';
import { AppWallet } from '../../../classes/AppWallet';
import { FormsModule } from '@angular/forms';
import { KcIconComponent, KcInputComponent } from '@kaspacom/ui';
import { EIP1193RequestPayload, EIP1193RequestType, EthTransactionParams } from '@kaspacom/wallet-messages';
import { ethers, FeeData } from 'ethers';


type AvailableOption = 'low' | 'normal' | 'priority' | 'custom';
const MIN_GAS_LIMIT = 21000n;
const MIN_CUSTOM_FEE = 1;


@Component({
  selector: 'l2-priority-fee-selection',
  templateUrl: './l2-priority-fee-selection.component.html',
  styleUrls: ['./l2-priority-fee-selection.component.scss'],
  imports: [
    NgIf,
    FormsModule,
    CommonModule,
    KcIconComponent,
    KcInputComponent,
  ],
  animations: [
    trigger('slideDown', [
      state('closed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden',
      })),
      state('open', style({
        height: '*',
        opacity: 1,
        overflow: 'visible',
      })),
      transition('closed => open', [animate('400ms ease-out')]),
      transition('open => closed', [animate('300ms ease-in')]),
    ]),
  ],
})
export class L2PriorityFeeSelectionComponent implements OnChanges {
  @Input() action!: WalletAction;
  @Input() wallet!: AppWallet;
  @Output() priorityFeeSelected = new EventEmitter<{
    priorityFee: bigint;
    baseFee: bigint;
  } | undefined>();
  @Output() gasLimitSelected = new EventEmitter<bigint | undefined>();

  protected customFee = signal<number>(0);
  protected selectedOption: AvailableOption = 'normal';
  protected hasGasLimitError = false;
  protected showFeeSelection = false;

  protected feeData: undefined | FeeData = undefined;
  protected gasLimit = signal<number | undefined>(undefined);

  protected gasLimitBigInt = computed(() => {
    const gl = this.gasLimit();
    if (gl === undefined || gl === null) return undefined;
    return BigInt(gl);
  });

  protected isGasLimitValid = computed(() => {
    const gl = this.gasLimit();
    if (gl === undefined || gl === null) return false;
    return gl >= Number(MIN_GAS_LIMIT);
  });

  protected isCustomFeeValid = computed(() => {
    if (this.selectedOption !== 'custom') return true;
    return this.customFee() >= MIN_CUSTOM_FEE;
  });

  protected gasFeeOtions = computed(() => {
    if (!this.feeData) return undefined;

    // EIP-1559 exposes maxPriorityFeePerGas; legacy chains only expose
    // gasPrice. Require at least one to be present so we can render a
    // sensible fee option list.
    if (this.feeData.maxPriorityFeePerGas == null && this.feeData.gasPrice == null) {
      return undefined;
    }

    const maxPriorityFeePerGas = this.feeData.maxPriorityFeePerGas || 0n;

    return {
      low: 1n,
      normal: maxPriorityFeePerGas,
      priority: maxPriorityFeePerGas * 2n,
      custom: BigInt(Math.max(0, Math.floor(this.customFee()))),
    };
  });

  protected gasFeeOptionToDisplay = computed(() => {
    if (!this.gasFeeOtions() || !this.gasLimitBigInt()) return undefined;

    const formattedOptions: { [key: string]: { value: bigint; display: number } } = {};
    const baseFeePerGas = (this.feeData!.gasPrice || 0n) - (this.feeData!.maxPriorityFeePerGas || 0n);

    for (const [key, value] of Object.entries(this.gasFeeOtions()!)) {
      formattedOptions[key] = {
        value,
        display: this.fromWeiToKas((value + baseFeePerGas) * this.gasLimitBigInt()!),
      };
    }

    return formattedOptions;
  });

  protected currentBaseFee = computed(() => {
    return this.fromWeiToKas(
      ((this.feeData?.gasPrice || 0n) - (this.feeData?.maxPriorityFeePerGas || 0n)) *
      (this.gasLimitBigInt() || 0n)
    );
  });

  protected totalFeeDisplay = computed(() => {
    const displayOptions = this.gasFeeOptionToDisplay();
    if (!displayOptions) return undefined;
    if (this.selectedOption === 'custom' && !this.isCustomFeeValid()) return undefined;
    if (!this.isGasLimitValid()) return undefined;
    return displayOptions[this.selectedOption]?.display;
  });

  toggleFeeSelection() {
    this.showFeeSelection = !this.showFeeSelection;
  }

  feeSelected(amount: bigint | undefined) {
    if (amount === undefined) {
      this.priorityFeeSelected.emit(undefined);
      return;
    }

    this.priorityFeeSelected.emit({
      priorityFee: amount,
      baseFee: (this.feeData?.gasPrice || 0n) - (this.feeData?.maxPriorityFeePerGas || 0n),
    });
  }

  updateGasLimit() {
    if (!this.isGasLimitValid()) {
      this.gasLimitSelected.emit(undefined);
    } else {
      this.gasLimitSelected.emit(this.gasLimitBigInt());
    }
  }

  selectOption(option: AvailableOption | string) {
    this.selectedOption = option as AvailableOption;

    if (option !== 'custom' && this.gasFeeOtions() && option in this.gasFeeOtions()!) {
      const fee = this.gasFeeOtions()![option as 'low' | 'normal' | 'priority' | 'custom'];
      this.feeSelected(fee);
    } else if (option === 'custom') {
      if (!this.isCustomFeeValid()) {
        this.priorityFeeSelected.emit(undefined);
      } else {
        this.feeSelected(BigInt(Math.floor(this.customFee())));
      }
    }
  }

  async ngOnChanges(_changes: SimpleChanges): Promise<void> {
    this.feeSelected(undefined);
    this.gasLimit.set(undefined);
    this.updateGasLimit();
    await this.loadPriorityFeeDataAndEmit(this.action);
  }

  async loadPriorityFeeDataAndEmit(action: WalletAction): Promise<void> {
    this.hasGasLimitError = false;
    const actionData: EIP1193RequestPayload<EIP1193RequestType> = action.data as EIP1193RequestPayload<EIP1193RequestType>;
    const transaction: EthTransactionParams = actionData.params[0] as EthTransactionParams;

    const provider = this.wallet.getL2Provider();
    if (!provider) throw new Error('No provider found');

    try {
      let gasForTransaction = await provider.estimateGas((await this.wallet.getL2Wallet())!, {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        nonce: transaction.nonce ? parseInt(transaction.nonce) : undefined,
      });

      if (gasForTransaction !== MIN_GAS_LIMIT) {
        gasForTransaction = gasForTransaction * 125n / 100n;
      }

      this.gasLimit.set(Number(gasForTransaction));
    } catch (error) {
      this.gasLimit.set(Number(MIN_GAS_LIMIT));
      this.hasGasLimitError = true;
    }

    this.feeData = await provider.getFeeData();
    this.customFee.set(Number(this.feeData.maxPriorityFeePerGas));
    this.selectOption(this.selectedOption);
    this.updateGasLimit();
  }

  fromWeiToKas(number: bigint): number {
    return Number(ethers.formatUnits(number, this.wallet.getL2Provider()?.getConfig().nativeCurrency.decimals));
  }

  fromWeiToGwei(number: bigint): string {
    return ethers.formatUnits(number, 9);
  }
}
