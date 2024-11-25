import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PasswordManagerService } from '../../services/password-manager.service';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({});
  loginError: boolean = false;

  constructor(
    private fb: FormBuilder,
    private passwordManagerService: PasswordManagerService,
    private router: Router,
    private walletService: WalletService,
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      password: ['', [Validators.required]],
    });


    // For faster developments
    // this.passwordManagerService.checkAndLoadPassword('123-asd').then((result) => this.router.navigate(['/dashboard']));   
  }

  get password() {
    return this.loginForm.get('password');
  }

  async onSubmit() {
    const password = this.loginForm.value.password;

    try {
      // Decrypt the stored password using the EncryptionService
      const isValidPassword =
        await this.passwordManagerService.checkAndLoadPassword(password);

      // If decryption is successful, navigate to the next page (e.g., dashboard)
      if (isValidPassword) {
        this.loginError = false;

        // Add navigation logic here

        if (await this.walletService.getWalletsCount() === 0) {
          this.router.navigate(['/import-wallet']);
        } else {
          this.router.navigate(['/dashboard']);
        }
        
      } else {
        this.loginError = true;
      }
    } catch (error) {
      this.loginError = true;
      console.error('Login failed', error);
    }
  }
}
