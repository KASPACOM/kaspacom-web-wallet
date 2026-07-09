import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { WalletService } from '../../services/wallet.service';
import { PasswordManagerService } from '../../services/password-manager.service';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';

@Component({
    selector: 'app-clear-data',
    templateUrl: './clear-data.component.html',
    styleUrls: ['./clear-data.component.scss'],
    imports: [FormsModule, ReactiveFormsModule]
})
export class ClearDataComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private passwordManagerService = inject(PasswordManagerService);

  clearDataForm: FormGroup = this.fb.group({
    confirmation: ['', [Validators.required, Validators.pattern('DELETE ALL DATA')]]
  });
  error: string = '';

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