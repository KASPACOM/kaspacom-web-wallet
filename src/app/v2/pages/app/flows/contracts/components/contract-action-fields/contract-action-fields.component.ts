import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcNumberInputComponent } from '@kaspacom/ui-kit';
import { AddressResolutionResult } from '../../../../../../../services/address-resolution.service';
import { AddressSmartInputComponent } from '../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CovenantDateTimeInputComponent } from '../../covenant-date-time-input.component';
import { ActionField } from '../../contract-action-fields.config';

@Component({
  selector: 'app-contract-action-fields',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KcNumberInputComponent,
    AddressSmartInputComponent,
    CovenantDateTimeInputComponent,
  ],
  templateUrl: './contract-action-fields.component.html',
  styleUrl: './contract-action-fields.component.scss',
})
export class ContractActionFieldsComponent {
  fields = input<ActionField[]>([]);
  isDisabled = input<boolean>(false);

  addressValue = input<string>('');
  amountValue = input<string>('');
  timestampValue = input<string>('');
  extraArgValues = input<Record<string, string>>({});

  addressChange = output<string>();
  addressResolved = output<AddressResolutionResult>();
  addressQrClick = output<void>();
  // kc-number-input's valueChange emits `unknown` — matches the `any`-typed
  // handlers (onTopUpAmountChange, onExtraArgValueChange, etc.) it feeds
  // elsewhere in this flow.
  amountChange = output<any>();
  amountMaxClick = output<void>();
  timestampChange = output<string>();
  extraArgChange = output<{ name: string; value: any }>();

  fieldTrackBy(_index: number, field: ActionField): string {
    switch (field.type) {
      case 'address':
      case 'amount':
      case 'timestamp':
        return field.key;
      case 'extra-int':
      case 'extra-bool':
        return field.paramName;
      case 'banner':
        return field.text;
    }
  }
}
