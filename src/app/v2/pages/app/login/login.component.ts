import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  KcButtonComponent,
  KcIconComponent,
  KcInputComponent,
} from 'kaspacom-ui';
import { PasswordManagerService } from '../../../../services/password-manager.service';
import { WalletService } from '../../../../services/wallet.service';
import { IFrameCommunicationApp } from '../../../../services/communication-service/communication-app/iframe-communication.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcInputComponent,
    KcButtonComponent,
    KcIconComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  private readonly passwordManagerService = inject(PasswordManagerService);

  private readonly walletService = inject(WalletService);

  private readonly router = inject(Router);

  passwordType = signal<'password' | 'text'>('password');
  passwordIcon = computed(() =>
    this.passwordType() === 'password' ? 'icon-eye' : 'icon-eye-crossed',
  );

  loginForm = this.fb.group({
    password: ['', [Validators.required]],
  });

  togglePwVisibility(): void {
    this.passwordType.set(
      'password' === this.passwordType() ? 'text' : 'password',
    );
  }

  getPasswordError(): string {
    const passwordControl = this.loginForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Password is required';
    }
    if (passwordControl?.hasError('invalidCredentials')) {
      return 'Invalid password';
    }
    return '';
  }

  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }
    const password = this.loginForm.value.password!;

    try {
      // Decrypt the stored password using the EncryptionService
      const isValidPassword =
        await this.passwordManagerService.checkAndLoadPassword(password);

      // If decryption is successful, navigate to the next page (e.g., dashboard)
      if (isValidPassword) {
        // this.loginError = false;

        await this.walletService.loadWallets();
        if (IFrameCommunicationApp.isIframe()) {
          this.router.navigate(['./wallet-selection']);
          return;
        } else {
          this.router.navigate(['./app/home']);
          return;
        }
        // if (this.walletService.getWalletsCount() === 0) {
        //   this.router.navigate(['/add-wallet']);
        // } else {
        //   if (IFrameCommunicationApp.isIframe()) {
        //     this.router.navigate(['/wallet-selection']);
        //   } else {
        //     await this.walletService.selectCurrentWalletFromLocalStorage();
        //     this.router.navigate(['/wallet-info']);
        //   }
        // }
      } else {
        this.loginForm.get('password')?.setErrors({ invalidCredentials: true });
      }
    } catch (error) {
      console.error('Login failed', error);
      this.loginForm.get('password')?.setErrors({ invalidCredentials: true });
    }
  }

  // onSubmit(): void {}
}
