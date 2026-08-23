import { Component, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  KcDialogComponent,
  KcNumberInputComponent,
  KcButtonComponent,
  SwitchOption,
} from '@kaspacom/ui-kit';
import { FormErrorMessageComponent } from '../../../../../../shared/components/form-error/form-error.component';
import type { SwapSettings } from '@kaspacom/swap-sdk';

export interface SwapSettingsDialogData {
  // Reserved keys read by KcDialogComponent itself off the same DIALOG_DATA.
  title?: string;
  showCloseButton?: boolean;
  initialSettings?: Partial<SwapSettings>;
}

@Component({
  selector: 'app-swap-settings-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    KcDialogComponent,
    KcNumberInputComponent,
    KcButtonComponent,
    FormErrorMessageComponent,
  ],
  templateUrl: './swap-settings-modal.component.html',
  styleUrl: './swap-settings-modal.component.scss',
})
export class SwapSettingsModalComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(DialogRef<SwapSettings | undefined>);
  private data = inject<SwapSettingsDialogData>(DIALOG_DATA, {
    optional: true,
  });

  settingsForm: FormGroup;
  selectedSlippage: Signal<number | null>;

  slippageOptions: SwitchOption[] = [
    { label: '0.1%', value: 0.1 },
    { label: '0.5%', value: 0.5 },
    { label: '1.5%', value: 1.5 },
  ];

  constructor() {
    const initialSettings = this.data?.initialSettings;
    this.settingsForm = this.createForm(
      initialSettings?.maxSlippage || '0.5',
      String(initialSettings?.swapDeadline || 20),
    );

    // FormControl.value is a plain getter, not a signal - computed() would
    // never re-run on click since nothing reactive is read. Bridge
    // valueChanges into a signal so it actually updates.
    const maxSlippageControl = this.settingsForm.get('maxSlippage')!;
    const maxSlippageValue = toSignal(maxSlippageControl.valueChanges, {
      initialValue: maxSlippageControl.value,
    });

    this.selectedSlippage = computed(() => {
      const slippage = parseFloat(maxSlippageValue() || '');
      if (isNaN(slippage)) return null;

      const tolerance = 0.001;
      if (Math.abs(slippage - 0.1) < tolerance) return 0.1;
      if (Math.abs(slippage - 0.5) < tolerance) return 0.5;
      if (Math.abs(slippage - 1.5) < tolerance) return 1.5;

      return null;
    });
  }

  private createForm(maxSlippage: string, swapDeadline: string): FormGroup {
    return this.fb.group({
      maxSlippage: [
        maxSlippage,
        [
          Validators.required,
          Validators.min(0.01),
          Validators.max(50),
          Validators.pattern(/^\d*\.?\d+$/),
        ],
      ],
      swapDeadline: [
        swapDeadline,
        [Validators.required, Validators.min(1), Validators.max(4320)],
      ],
    });
  }

  onSlippageClick(value: number) {
    this.settingsForm.get('maxSlippage')?.setValue(value.toString());
    this.settingsForm.get('maxSlippage')?.markAsTouched();
  }

  onSave() {
    if (this.settingsForm.valid) {
      this.dialogRef.close({
        maxSlippage: this.settingsForm.get('maxSlippage')?.value,
        swapDeadline: parseInt(
          this.settingsForm.get('swapDeadline')?.value,
          10,
        ),
      });
    }
  }
}
