import { NgIf } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordManagerService } from '../../services/password-manager.service';
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';

@Component({
  selector: 'app-set-password',
  standalone: true,
  templateUrl: './set-password.component.html',
  styleUrls: ['./set-password.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, ZXingScannerModule],
})
export class SetPasswordComponent implements OnInit {
  @ViewChild('scanner') scanner: ZXingScannerComponent | undefined;

  passwordForm: FormGroup;
  protected isScanning = signal(false);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly passwordManagerService: PasswordManagerService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize the form with validation rules
    this.passwordForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]], // Min length of 6 characters
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator, // Custom validator to match password and confirm password
      }
    );
  }

  ngOnInit(): void {}

  // Custom validator to check if password and confirmPassword match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    } else {
      form.get('confirmPassword')?.setErrors(null);
    }
  }

  // Submit the form and store the password
  async setPassword(): Promise<void> {
    if (this.passwordForm.valid) {
      const password = this.passwordForm.value.password;

      await this.passwordManagerService.setSavedPassword(password);

      // Store password (e.g., encrypted)
      this.router.navigate(['/login']);
    } else {
      alert('Please correct the errors in the form.');
    }
  }

  // Getter for password control (to easily check validation in the template)
  get password() {
    return this.passwordForm.get('password');
  }

  // Getter for confirmPassword control (to easily check validation in the template)
  get confirmPassword() {
    return this.passwordForm.get('confirmPassword');
  }

  canScanQrCode(): boolean {
    return true;
  }

  importFromQrCode() {
    this.isScanning.set(true);
    this.cdr.detectChanges();
    this.scanner!.scanComplete.subscribe((result) => {
      if (result) {
        this.isScanning.set(false);
        this.passwordManagerService.importFromQr(result.getText());
        this.router.navigate(['/login']);
      }
    });
  }
}
