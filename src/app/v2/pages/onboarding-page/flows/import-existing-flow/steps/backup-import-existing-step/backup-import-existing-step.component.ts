import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from 'kaspacom-ui';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui-kit';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { PasswordManagerService } from '../../../../../../../services/password-manager.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-backup-import-existing-step',
  imports: [FormsModule, KcButtonComponent, KcIconComponent],
  templateUrl: './backup-import-existing-step.component.html',
  styleUrl: './backup-import-existing-step.component.scss',
})
export class BackupImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );
  private readonly passwordManagerService = inject(PasswordManagerService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  isImporting = signal(false);
  backupData = '';

  async importFromFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.key';

    input.addEventListener('change', async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev: any) => {
        this.backupData = ev.target.result;
        await this.importBackup();
      };
      reader.readAsText(file);
    });

    input.click();
  }

  async importBackup(): Promise<void> {
    if (!this.backupData.trim()) {
      return;
    }

    // Set loading state immediately for instant feedback
    this.isImporting.set(true);

    // Small delay to ensure UI updates
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // Import the encrypted data
      const success = this.passwordManagerService.importFromEncryptedData(
        this.backupData.trim(),
      );

      if (!success) {
        this.notificationService.error(
          'Invalid Backup',
          'Please check your backup data and try again.',
        );
        this.isImporting.set(false);
        return;
      }

      this.notificationService.success(
        'Success',
        'Backup imported! Redirecting to login...',
      );

      // Reload the page to refresh the login state
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      console.error('Error importing backup:', error);
      this.notificationService.error(
        'Import Failed',
        'Unable to import backup. Please try again.',
      );
      this.isImporting.set(false);
    }
  }
}
