import { CommonModule } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { KcButtonComponent, NotificationService } from 'kaspacom-ui';
import { ImportSwitchComponent } from './component/import-switch/import-switch.component';
import { ImportSwitchMethod } from './component/import-switch/import-switch-method.enum';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { QrScannerService } from '../../../../../../../services/qr-scanner.service';
import { PasswordManagerService } from '../../../../../../../services/password-manager.service';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [CommonModule, KcButtonComponent, ImportSwitchComponent],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();

  ImportSwitchMethod = ImportSwitchMethod;

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );
  private readonly qrScannerService = inject(QrScannerService);
  private readonly passwordManagerService = inject(PasswordManagerService);
  private readonly notificationService = inject(NotificationService);

  importMethod = signal<ImportSwitchMethod>(ImportSwitchMethod.SEED_PHRASE);
  userHasWallets = computed(() => this.passwordManagerService.isUserHasSavedPassword());

  constructor() {
    this.importMethod.set(
      this.importExistingFlowService.model().importSwitchMethod,
    );
  }

  onImportMethodChange(method: ImportSwitchMethod): void {
    this.importMethod.set(method);
    this.importExistingFlowService.setImportSwitchMethod(method);
  }

  onContinue(): void {
    this.importExistingFlowService.setImportSwitchMethod(this.importMethod());
    this.next.emit();
  }

  onQrScanClick(): void {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
    } else {
      this.qrScannerService.startScanning({
        scannerId: 'qr-scanner-backup-import',
        title: 'Scan Backup QR Code',
        instruction: 'Point camera at QR code containing your backup data',
        successMessage: 'Backup scanned successfully!',
        validateAddress: false,
        onSuccess: (backupData: string) => {
          this.handleBackupData(backupData);
        },
        onError: (error: string) => {
          console.error('QR scanning error:', error);
        },
      });
    }
  }

  private async handleBackupData(backupData: string): Promise<void> {
    try {
      // Import the encrypted data using the same logic as backup file import
      const success = this.passwordManagerService.importFromEncryptedData(
        backupData.trim()
      );
      
      if (!success) {
        this.notificationService.error(
          'Invalid Backup',
          'Please check your backup QR code and try again.'
        );
        return;
      }

      this.notificationService.success(
        'Success',
        'Backup imported! Redirecting to login...'
      );

      // Reload the page to refresh the login state
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      console.error('Error importing backup from QR:', error);
      this.notificationService.error(
        'Import Failed',
        'Unable to import backup. Please try again.'
      );
    }
  }
}
