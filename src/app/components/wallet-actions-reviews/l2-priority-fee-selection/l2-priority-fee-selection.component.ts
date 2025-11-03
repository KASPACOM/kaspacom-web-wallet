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
  NgFor,
  NgIf,
  TitleCasePipe,
} from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletAction } from '../../../types/wallet-action';
import { AppWallet } from '../../../classes/AppWallet';
import { FormsModule } from '@angular/forms';
import { KcIconComponent, KcInputComponent } from '@kaspacom/ui';
import { EIP1193RequestPayload, EIP1193RequestType, EthTransactionParams } from '@kaspacom/wallet-messages';
import { ethers, FeeData } from 'ethers';


type AvailableOption = 'low' | 'normal' | 'priority' | 'custom';
const MIN_GAS_LIMIT = 21000n;


@Component({
  selector: 'l2-priority-fee-selection',
  templateUrl: './l2-priority-fee-selection.component.html',
  styleUrls: ['./l2-priority-fee-selection.component.scss'],
  imports: [
    NgIf,
    NgFor,
    SompiToNumberPipe,
    FormsModule,
    TitleCasePipe,
    CommonModule,
    KcIconComponent,
    KcInputComponent,
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

  protected feeData:
    | undefined
    | FeeData = undefined;
  protected gasLimit = signal<number | undefined>(undefined);

  protected gasLimitBigInt = computed(() => {
    if (!this.gasLimit()) {
      return undefined;
    }

    return BigInt(this.gasLimit()!);
  })

  protected gasFeeOtions = computed(() => {

    if (!this.feeData) {
      return undefined;
    }

    const baseFee = this.feeData.maxPriorityFeePerGas;
    if (!baseFee) {
      return undefined
    }

    const maxPriorityFeePerGas = this.feeData.maxPriorityFeePerGas || 0n;



    const low = 1n;
    const normal = maxPriorityFeePerGas;
    const priority = maxPriorityFeePerGas * 2n;
    const custom = BigInt(this.customFee());

    return {
      low,
      normal,
      priority,
      custom,
    };
  })

  protected gasFeeOptionToDisplay = computed(() => {
    if (!this.gasFeeOtions() || !this.gasLimit()) {
      return undefined;
    }

    const formattedOptions: {
      [key: string]: {
        value: bigint;
        display: number;
      }
    } = {};

    for (const [key, value] of Object.entries(this.gasFeeOtions()!)) {
      formattedOptions[key] = {
        value,
        display: this.fromWeiToKas((value + ((this.feeData!.gasPrice || 0n) - (this.feeData!.maxPriorityFeePerGas || 0n))) * this.gasLimitBigInt()!),
      }
    }

    return formattedOptions;
  })

  protected currentBaseFee = computed(() => {
    return this.fromWeiToKas(((this.feeData?.gasPrice || 0n) - (this.feeData?.maxPriorityFeePerGas || 0n)) * (this.gasLimitBigInt() || 0n));
  })


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
    this.gasLimitSelected.emit(this.gasLimitBigInt());
  }

  selectOption(option: AvailableOption | string) {
    this.selectedOption = option as AvailableOption;

    if (
      option !== 'custom' &&
      this.gasFeeOtions() &&
      option in this.gasFeeOtions()!
    ) {
      const fee =
        this.gasFeeOtions()![option as 'low' | 'normal' | 'priority' | 'custom'];
      this.feeSelected(fee);

    } else if (option == 'custom') {
      this.feeSelected(
        BigInt(this.customFee())
      );
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
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

    if (!provider) {
      throw new Error('No provider found');
    }


    try {
      let gasForTransaction = await provider.estimateGas((await this.wallet.getL2Wallet())!, {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        nonce: transaction.nonce ? parseInt(transaction.nonce) : undefined,
      })

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
}
