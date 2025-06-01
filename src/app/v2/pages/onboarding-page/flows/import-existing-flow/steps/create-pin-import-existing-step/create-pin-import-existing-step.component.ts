import { CommonModule } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  KcButtonComponent,
  KcIconComponent,
  KcInputComponent,
} from 'kaspacom-ui';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';

@Component({
  selector: 'app-create-pin-import-existing-step',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcIconComponent,
  ],
  templateUrl: './create-pin-import-existing-step.component.html',
  styleUrl: './create-pin-import-existing-step.component.scss',
})
export class CreatePinImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly fb = inject(FormBuilder);

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );

  passwordForm = this.fb.group(
    {
      password: [
        this.importExistingFlowService.model().password,
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/),
        ],
      ],
      confirmPassword: [
        this.importExistingFlowService.model().confirmPassword,
        [Validators.required],
      ],
    },
    { validators: this.passwordMatchValidator },
  );

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      return { passwordsDoNotMatch: true };
    }
    return null;
  }

  passwordType = signal<'password' | 'text'>('password');
  passwordConfirmType = signal<'password' | 'text'>('password');
  passwordIcon = computed(() =>
    this.passwordType() === 'password' ? 'icon-eye' : 'icon-eye-crossed',
  );
  passwordConfirmIcon = computed(() =>
    this.passwordConfirmType() === 'password' ? 'icon-eye' : 'icon-eye-crossed',
  );

  togglePwVisibility(): void {
    this.passwordType.set(
      'password' === this.passwordType() ? 'text' : 'password',
    );
  }
  toggleConfirmPwVisibility(): void {
    this.passwordConfirmType.set(
      'password' === this.passwordConfirmType() ? 'text' : 'password',
    );
  }

  isInvalid(controlName: string): boolean {
    const control = this.passwordForm.get(controlName);
    const passwordsMatchError =
      this.passwordForm.hasError('passwordsDoNotMatch') &&
      (control ? control.dirty || control.touched : false);
    const formCheckResult = control
      ? control.invalid && (control.dirty || control.touched)
      : false;
    return (
      formCheckResult ||
      (controlName === 'confirmPassword' && passwordsMatchError)
    );
  }

  getPasswordErrorMessage(): string | undefined {
    if (this.passwordForm.hasError('required', 'password')) {
      return 'Password is required';
    }
    if (this.passwordForm.hasError('minlength', 'password')) {
      return 'Password is too short';
    }
    if (this.passwordForm.hasError('pattern', 'password')) {
      return 'Password must contain letters and numbers';
    }
    return undefined;
  }

  getConfirmPasswordErrorMessage(): string | undefined {
    if (this.passwordForm.hasError('passwordsDoNotMatch')) {
      return 'Passwords do not match';
    }
    return undefined;
  }

  onSubmit() {}
}
