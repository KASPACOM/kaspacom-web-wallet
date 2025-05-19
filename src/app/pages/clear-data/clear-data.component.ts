import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { WalletService } from '../../services/wallet.service';
import { PasswordManagerService } from '../../services/password-manager.service';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';

@Component({
  selector: 'app-clear-data',
  standalone: true,
  templateUrl: './clear-data.component.html',
  styleUrls: ['./clear-data.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf]
})
export class ClearDataComponent {
  clearDataForm: FormGroup = this.fb.group({
    confirmation: ['', [Validators.required, Validators.pattern('DELETE ALL DATA')]]
  });
  error: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private passwordManagerService: PasswordManagerService
  ) {}

  async onSubmit() {
    if (this.clearDataForm.valid) {
      try {
        // Clear any other potential data
        await this.passwordManagerService.clearAllData();

        // Refresh the page
        window.location.reload();

      } catch (error: unknown) {
        this.error = 'Failed to clear data. Please try again.';
        console.error('Error clearing data:', error);
      }
    }
  }

  cancel() {
    this.router.navigate(['/login']);
  }
} 