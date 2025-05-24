import { Component, forwardRef, input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { ComponentSize } from '../../enums/sizing.enum';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="checkbox-container"
      [class.checked]="checked"
      [class.disabled]="isDisabled()"
      [ngClass]="sizeClass()"
      (click)="toggle()"
    >
      <div class="checkbox">
        <div class="checkbox-inner" [class.checked]="checked">
          <svg *ngIf="checked" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      <label *ngIf="label()" class="checkbox-label">{{ label() }}</label>
    </div>
  `,
  styles: [`
    .checkbox-container {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }

    .checkbox-container.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .checkbox-inner {
      border-radius: 4px;
      border: 2px solid var(--gray-50);
      background-color: var(--gray-20);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-sizing: border-box;
      position: relative;
    }

    .checkbox-inner.checked {
      border-color: var(--kaspa-50);
      background-color: var(--kaspa-50);
    }

    .checkbox-inner svg {
      color: white;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100%;
      height: 100%;
    }

    /* Sizing */
    .checkbox-container.xs .checkbox-inner {
      width: 14px;
      height: 14px;
      min-width: 14px;
      min-height: 14px;
    }

    .checkbox-container.sm .checkbox-inner {
      width: 16px;
      height: 16px;
      min-width: 16px;
      min-height: 16px;
    }

    .checkbox-container.md .checkbox-inner {
      width: 18px;
      height: 18px;
      min-width: 18px;
      min-height: 18px;
    }

    .checkbox-container.lg .checkbox-inner {
      width: 20px;
      height: 20px;
      min-width: 20px;
      min-height: 20px;
    }

    .checkbox-container.xlg .checkbox-inner {
      width: 24px;
      height: 24px;
      min-width: 24px;
      min-height: 24px;
    }

    .checkbox-container.xs svg {
      width: 10px !important;
      height: 10px !important;
    }

    .checkbox-container.sm svg {
      width: 12px !important;
      height: 12px !important;
    }

    .checkbox-container.md svg {
      width: 14px !important;
      height: 14px !important;
    }

    .checkbox-container.lg svg {
      width: 16px !important;
      height: 16px !important;
    }

    .checkbox-container.xlg svg {
      width: 18px !important;
      height: 18px !important;
    }

    /* Typography for labels */
    .checkbox-container.xs .checkbox-label {
      font-size: 0.75rem;
    }

    .checkbox-container.sm .checkbox-label {
      font-size: 0.875rem;
    }

    .checkbox-container.md .checkbox-label {
      font-size: 1rem;
    }

    .checkbox-container.lg .checkbox-label {
      font-size: 1.125rem;
    }

    .checkbox-container.xlg .checkbox-label {
      font-size: 1.25rem;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true
    }
  ]
})
export class CheckboxComponent implements ControlValueAccessor, OnInit, OnChanges {
  // Inputs
  size = input<ComponentSize>(ComponentSize.MD);
  isDisabled = input<boolean>(false);
  label = input<string>('');
  isChecked = input<boolean>(false);

  // State
  checked = false;

  // Output
  @Output() checkedChange = new EventEmitter<boolean>();

  // ControlValueAccessor
  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    // Initialize the checked state from the isChecked input
    this.checked = this.isChecked();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update checked state when isChecked input changes
    if (changes['isChecked']) {
      this.checked = this.isChecked();
    }
  }

  // Calculate size class
  sizeClass() {
    const sizeMap: Record<ComponentSize, string> = {
      [ComponentSize.XS]: 'xs',
      [ComponentSize.SM]: 'sm',
      [ComponentSize.MD]: 'md',
      [ComponentSize.LG]: 'lg',
      [ComponentSize.XLG]: 'xlg'
    };

    return sizeMap[this.size()];
  }

  // Toggle the checkbox
  toggle() {
    if (this.isDisabled()) {
      return;
    }

    this.onTouched();
    this.checked = !this.checked;

    // Update the input value
    // Emit event for ngModel binding
    this.checkedChange.emit(this.checked);

    // Emit event for reactive forms
    this.onChange(this.checked);
  }

  // ControlValueAccessor implementation
  writeValue(value: boolean): void {
    this.checked = !!value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Update the disabled state
  }
}
