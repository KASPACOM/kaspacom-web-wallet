import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  KcDialogComponent,
  KcInputComponent,
  KcButtonComponent,
} from '@kaspacom/ui-kit';
import { FormErrorMessageComponent } from '../../../../../../shared/components/form-error/form-error.component';
import type { SwapSettings } from '@kaspacom/swap-sdk';

export interface SwapSettingsDialogData {
  title?: string;
  initialSettings?: Partial<SwapSettings>;
}

@Component({
  selector: 'app-swap-settings-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    KcDialogComponent,
    KcInputComponent,
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

  selectedSlippage = computed(() => {
    const slippage = parseFloat(
      this.settingsForm?.get('maxSlippage')?.value || '',
    );
    if (isNaN(slippage)) return null;

    const tolerance = 0.001;
    if (Math.abs(slippage - 0.1) < tolerance) return 0.1;
    if (Math.abs(slippage - 0.5) < tolerance) return 0.5;
    if (Math.abs(slippage - 1.5) < tolerance) return 1.5;

    return null;
  });

  constructor() {
    const initial = this.data?.initialSettings;
    this.settingsForm = this.createForm(
      initial?.maxSlippage || '0.5',
      String(initial?.swapDeadline || 20),
    );
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

  onClose() {
    this.dialogRef.close();
  }
}
