import { Component, input } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'kc-form-error-message',
  template: `
    @if (
      (control()?.touched || control()?.dirty) &&
      (control()?.errors || form()?.errors)
    ) {
      <div class="error-message">
        @if (control()?.errors?.['required']) {
          {{ customErrorMessages()['required'] || fieldName() + ' is required.' }}
        } @else if (control()?.errors?.['pattern']) {
          {{
            customErrorMessages()['pattern'] ||
              'Please enter a valid ' +
                fieldName() +
                ' (e.g., ' +
                validPatternExample() +
                ')'
          }}
        } @else if (control()?.errors?.['minlength']) {
          {{ fieldName() }} must be at least
          {{ control()?.errors?.['minlength'].requiredLength }} characters long.
        } @else if (control()?.errors?.['maxlength']) {
          {{ fieldName() }} cannot be more than
          {{ control()?.errors?.['maxlength'].requiredLength }} characters long.
        } @else if (control()?.errors?.['containsEmoji']) {
          {{ fieldName() }} cannot contain emoji.
        } @else if (control()?.errors?.['min']) {
          {{
            customErrorMessages()['min'] ||
              fieldName() +
                ' must be greater than or equal to ' +
                control()?.errors?.['min'].min
          }}
        } @else if (control()?.errors?.['max']) {
          {{
            customErrorMessages()['max'] ||
              fieldName() +
                ' must be less than or equal to ' +
                control()?.errors?.['max'].max
          }}
        } @else if (control()?.errors?.['invalidAddress']) {
          Field is not a valid address
        } @else if (control()?.errors?.['email']) {
          {{
            customErrorMessages()['email'] || 'Please enter a valid email address.'
          }}
        } @else if (control()?.errors?.['requiredFile']) {
          {{ customErrorMessages()['requiredFile'] || 'The file is required' }}
        } @else if (control()?.errors?.['invalidFileType']) {
          {{
            customErrorMessages()['invalidFileType'] ||
              'Please upload a valid file type'
          }}
        } @else if (control()?.errors?.['notUnique']) {
          {{
            customErrorMessages()['notUnique'] ||
              'This ' + fieldName() + ' is already taken.'
          }}
        } @else if (form()?.errors?.['greaterThanOther']) {
          {{ customErrorMessages()['greaterThanOther'] }}
        } @else if (control()?.errors?.['invalid']) {
          {{ customErrorMessages()['invalid'] }}
        } @else if (control()?.errors?.['isGreaterThan']) {
          {{ customErrorMessages()['isGreaterThan'] }}
        }
      </div>
    }
  `,
  styles: [
    `
      .error-message {
        color: var(--kc-color-danger-500);
        font-size: 12px;
      }
    `,
  ],
  standalone: true,
  imports: [],
})
export class FormErrorMessageComponent {
  form = input<FormGroup | null>(null);
  control = input<AbstractControl | null>(null);
  fieldName = input<string>('');
  validPatternExample = input<string>('');

  customErrorMessages = input<{ [key: string]: string }>({});
}
