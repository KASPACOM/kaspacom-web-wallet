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
import { Router, RouterLink } from '@angular/router';
import { LOCAL_STORAGE_KEYS } from '../../../../config/consts';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcInputComponent,
    KcButtonComponent,
    KcIconComponent,
    RouterLink,
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

  isSubmitting = signal<boolean>(false);

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
    if (this.loginForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    const password = this.loginForm.value.password!;

    try {
      // Decrypt the stored password using the EncryptionService
      const isValidPassword =
        await this.passwordManagerService.checkAndLoadPassword(password);

      // If decryption is successful, navigate to the next page (e.g., dashboard)
      if (isValidPassword) {
        // this.loginError = false;

        // Load wallets only once
        await this.walletService.loadWallets();

        if (IFrameCommunicationApp.isIframe()) {
          this.router.navigate(['./wallet-selection']);
        } else {
          // Don't load wallets again, just select the current wallet
          await this.walletService.selectCurrentWallet(
            localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_SELECTED_WALLET) ||
            (this.walletService.getAllWallets()()?.length ? this.walletService.getAllWallets()()![0].getIdWithAccount() : '')
          );
          this.router.navigate(['./app/home']);
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
        this.isSubmitting.set(false);
      }
    } catch (error) {
      console.error('Login failed', error);
      this.loginForm.get('password')?.setErrors({ invalidCredentials: true });
      this.isSubmitting.set(false);
    }
  }

  // onSubmit(): void {}
}
