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

@Component({
  selector: 'app-create-password-new-wallet-step',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcInputComponent,
    KcButtonComponent,
    KcIconComponent,
  ],
  templateUrl: './create-password-new-wallet-step.component.html',
  styleUrl: './create-password-new-wallet-step.component.scss',
})
export class CreatePasswordNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly fb = inject(FormBuilder);

  passwordForm = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
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
      this.passwordForm.errors?.['passwordsDoNotMatch'] &&
      (control ? control.dirty || control.touched : false);
    const formCheckResult = control
      ? control.invalid && (control.dirty || control.touched)
      : false;
    return (
      formCheckResult ||
      (controlName === 'confirmPassword' && passwordsMatchError)
    );
  }

  onSubmit(): void {
    if (this.passwordForm.valid) {
      this.next.emit();
    } else {
      console.log('invalid form');
    }
  }
}
