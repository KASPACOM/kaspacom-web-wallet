import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
} from '@angular/core';

import { QRCodeComponent } from 'angularx-qrcode';
import { NotificationService } from 'kaspacom-ui';
import { KcButtonComponent, KcIconComponent, KcInputComponent } from '@kaspacom/ui-kit';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { PasswordManagerService } from '../../../../../services/password-manager.service';
import { LOCAL_STORAGE_KEYS } from '../../../../../config/consts';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-export-kaspacom-wallet-flow-page',
  standalone: true,
  imports: [
    QRCodeComponent,
    KcButtonComponent,
    KcIconComponent,
    KcInputComponent,
    FormsModule,
  ],
  templateUrl: './export-kaspacom-wallet-flow-page.component.html',
  styleUrl: './export-kaspacom-wallet-flow-page.component.scss',
})
export class ExportKaspacomWalletFlowPageComponent extends FlowPageBaseComponent {
  private passwordManagerService = inject(PasswordManagerService);
  private notificationService = inject(NotificationService);

  get config(): IFlowPageConfig {
    return {
      id: 'export-kaspacom-wallet',
      title: 'Export Kaspacom Wallet',
      canNavigateBack: true,
      canClose: true,
      showTitle: true,
      showBackground: true,
    };
  }

  // State management
  currentStep = signal<'initial' | 'password' | 'export'>('initial');
  password = signal<string>('');
  isLoading = signal<boolean>(false);
  encryptedUserData = signal<string | null>(null);
  passwordError = signal<string | null>(null);

  // QR Code settings
  maxDataLength = 2331;
  qrCodeSize = signal<number>(280);

  // Computed properties
  showPasswordStep = computed(() => this.currentStep() === 'password');
  showExportStep = computed(() => this.currentStep() === 'export');
  canShowQrCode = computed(() => {
    const data = this.encryptedUserData();
    return data && data.length < this.maxDataLength;
  });
  dataTooBig = computed(() => {
    const data = this.encryptedUserData();
    return data && data.length >= this.maxDataLength;
  });

  @HostListener('window:resize')
  onResize() {
    this.updateQrCodeSize();
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.updateQrCodeSize();
  }

  private updateQrCodeSize(): void {
    const width = window.innerWidth;
    if (width <= 480) {
      this.qrCodeSize.set(220);
    } else if (width <= 768) {
      this.qrCodeSize.set(260);
    } else {
      this.qrCodeSize.set(300);
    }
  }

  onStartExport(): void {
    this.currentStep.set('password');
  }

  onPasswordInput(): void {
    // Clear error when user starts typing
    if (this.passwordError()) {
      this.passwordError.set(null);
    }
  }

  async onVerifyPassword(): Promise<void> {
    const passwordValue = this.password();

    // Clear any existing error
    this.passwordError.set(null);

    if (!passwordValue.trim()) {
      this.passwordError.set('Please enter your password');
      return;
    }

    this.isLoading.set(true);

    try {
      const isValid =
        await this.passwordManagerService.checkPassword(passwordValue);

      if (!isValid) {
        this.passwordError.set('Incorrect password. Please try again.');
        this.password.set('');
        return;
      }

      // Get encrypted user data
      const encryptedData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);

      if (!encryptedData) {
        this.passwordError.set('No wallet data found to export');
        return;
      }

      this.encryptedUserData.set(encryptedData);
      this.currentStep.set('export');
    } catch (error) {
      console.error('Password verification error:', error);
      this.passwordError.set('Failed to verify password');
    } finally {
      this.isLoading.set(false);
    }
  }

  onDownloadKeyFile(): void {
    const data = this.encryptedUserData();
    if (!data) {
      this.notificationService.error('Error', 'No data to download');
      return;
    }

    try {
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'kaspacom-wallets.key';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      this.notificationService.success(
        'Success',
        'Wallet file downloaded successfully',
      );
    } catch (error) {
      console.error('Download error:', error);
      this.notificationService.error('Error', 'Failed to download wallet file');
    }
  }

  onCopyQrData(): void {
    const data = this.encryptedUserData();
    if (!data) {
      this.notificationService.error('Error', 'No data to copy');
      return;
    }

    navigator.clipboard.writeText(data).then(
      () => {
        this.notificationService.success(
          'Success',
          'Wallet data copied to clipboard',
        );
      },
      (error) => {
        console.error('Copy error:', error);
        this.notificationService.error('Error', 'Failed to copy to clipboard');
      },
    );
  }

  onHideKeyInfo(): void {
    this.currentStep.set('initial');
    this.password.set('');
    this.encryptedUserData.set(null);
    this.passwordError.set(null);
  }

  onBackToPassword(): void {
    this.currentStep.set('password');
    this.encryptedUserData.set(null);
    this.passwordError.set(null);
  }
}
