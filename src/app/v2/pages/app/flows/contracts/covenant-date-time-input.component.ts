import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-covenant-date-time-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="date-field flex column gap-6" [class.invalid]="!isValid">
      <label class="date-field-label text-gray-60 typo-text-1">{{ label }}</label>
      <input
        type="datetime-local"
        class="date-input p-12 rounded-lg text-white typo-text-2"
        [ngModel]="value"
        (ngModelChange)="valueChange.emit($event || '')"
        [disabled]="isDisabled"
      />
      @if (!isValid && invalidReason) {
      <span class="field-error typo-text-2">{{ invalidReason }}</span>
      }
    </div>
  `,
  styles: [`
    .date-field {
      min-width: 0;
      width: 100%;
    }

    .date-field-label {
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .date-input {
      appearance: none;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-secondary);
      box-sizing: border-box;
      color-scheme: dark;
      font-family: inherit;
      min-height: 52px;
      outline: none;
      padding-right: 14px;
      transition: border-color 0.2s, background 0.2s;
      width: 100%;
    }

    .date-input:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.05);
    }

    .date-input:focus {
      border-color: var(--kaspa-20);
      background: rgba(255, 255, 255, 0.04);
    }

    .date-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .date-field.invalid .date-input {
      border-color: var(--red-20);
    }

    .date-input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      filter: invert(1);
      opacity: 0.55;
    }

    .date-input::-webkit-calendar-picker-indicator:hover {
      opacity: 0.85;
    }

    .field-error {
      color: var(--red-20);
    }
  `],
})
export class CovenantDateTimeInputComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() isDisabled = false;
  @Input() isValid = true;
  @Input() invalidReason = '';

  @Output() valueChange = new EventEmitter<string>();
}
