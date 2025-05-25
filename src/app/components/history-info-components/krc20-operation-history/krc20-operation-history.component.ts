import { Component, Input } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import {
  AcceptedStatus,
  OperationDetails,
} from '../../../services/kasplex-api/dtos/operation-details-response';
import { UtilsHelper } from '../../../services/utils.service';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import { AppWallet } from '../../../classes/AppWallet';

@Component({
    selector: 'krc20-operations-history',
    templateUrl: './krc20-operation-history.component.html',
    styleUrls: ['./krc20-operation-history.component.scss'],
    imports: [NgIf, NgFor, FormsModule, SompiToNumberPipe, CommonModule]
})
export class Krc20OperationHistoryComponent {
  public AcceptedStatus = AcceptedStatus;
  public KRC20OperationType = KRC20OperationType;
  public Number = Number;

  @Input() operations: undefined | OperationDetails[];
  @Input() wallet!: AppWallet;

  constructor(protected readonly utils: UtilsHelper) {}

  public isNullOrEmptyString(value: string | null | undefined): boolean {
    return this.utils.isNullOrEmptyString(value);
  }

  public getOperationTitle(operation: OperationDetails): string {
    let op = operation.op.charAt(0).toUpperCase() + operation.op.slice(1);

    if (operation.op === KRC20OperationType.SEND) {
      if (
        operation.from === this.wallet.getAddress() &&
        operation.to === this.wallet.getAddress()
      ) {
        op = `${op} (Cancel List)`;
      } else if (
        operation.op === KRC20OperationType.SEND &&
        operation.to === this.wallet.getAddress()
      ) {
        op = `${op} (Buy)`;
      } else if (
        operation.op === KRC20OperationType.SEND &&
        operation.from === this.wallet.getAddress()
      ) {
        op = `${op} (Sell)`;
      }
    }

    return op;
  }

  public getOperationWalletBalance(operation: OperationDetails): {
    balance: bigint;
    isLocked: boolean;
  } {
    switch (operation.op) {
      case KRC20OperationType.MINT:
        return {
          balance: this.isNullOrEmptyString(operation.amt)
            ? 0n
            : BigInt(operation.amt!),
          isLocked: false,
        };
      case KRC20OperationType.DEPLOY:
        return {
          balance: this.isNullOrEmptyString(operation.pre)
            ? 0n
            : BigInt(operation.pre!),
          isLocked: false,
        };
      case KRC20OperationType.TRANSFER:
      case KRC20OperationType.SEND:
        const isToThisWallet = operation.to === this.wallet.getAddress();

        return {
          balance:
            (this.isNullOrEmptyString(operation.amt)
              ? 0n
              : BigInt(operation.amt!)) * (isToThisWallet ? 1n : -1n),
          isLocked: false,
        };

      case KRC20OperationType.LIST:
        return {
          balance: this.isNullOrEmptyString(operation.amt)
            ? 0n
            : BigInt(operation.amt!),
          isLocked: true,
        };
      default:
        return {
          balance: 0n,
          isLocked: false,
        };
    }
  }
}
