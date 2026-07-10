import {
  Component,
  computed,
  inject,
  OnChanges,
  SimpleChanges,
  input,
  output,
} from '@angular/core';

import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { KcBaseModalComponent } from 'kaspacom-ui';
import { KcNumberInputComponent, KcButtonComponent } from '@kaspacom/ui-kit';
import { FormErrorMessageComponent } from '../../../../../../shared/components/form-error/form-error.component';
import type { SwapSettings } from '@kaspacom/swap-sdk';

@Component({
  selector: 'app-swap-settings-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    KcBaseModalComponent,
    KcNumberInputComponent,
    KcButtonComponent,
    FormErrorMessageComponent,
  ],
  templateUrl: './swap-settings-modal.component.html',
  styleUrl: './swap-settings-modal.component.scss',
})
export class SwapSettingsModalComponent implements OnChanges {
  private fb = inject(FormBuilder);

  readonly open = input(false);
  readonly initialSettings = input<Partial<SwapSettings>>();
  readonly close = output<void>();
  readonly save = output<SwapSettings>();

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
    this.settingsForm = this.createForm('0.5', '20');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialSettings'] || changes['open']) {
      const initialSettings = this.initialSettings();
      if (this.open() && initialSettings) {
        const maxSlippageValue = initialSettings.maxSlippage || '0.5';
        const swapDeadlineValue = String(initialSettings.swapDeadline || 20);
        this.settingsForm = this.createForm(
          maxSlippageValue,
          swapDeadlineValue,
        );
      }
    }
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
      this.save.emit({
        maxSlippage: this.settingsForm.get('maxSlippage')?.value,
        swapDeadline: parseInt(
          this.settingsForm.get('swapDeadline')?.value,
          10,
        ),
      });
    }
  }

  onClose() {
    this.close.emit();
  }
}
