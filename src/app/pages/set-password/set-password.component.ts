import { NgIf } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  signal,
  ViewChild,
  ElementRef,
  OnDestroy,
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
import { MessagePopupService } from '../../services/message-popup.service';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-set-password',
  standalone: true,
  templateUrl: './set-password.component.html',
  styleUrls: ['./set-password.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf],
})
export class SetPasswordComponent implements OnInit, OnDestroy {
  @ViewChild('scanner') scannerElement!: ElementRef;

  passwordForm: FormGroup;
  protected isScanning = signal(false);
  protected isScanningMode = signal(false);
  protected showBrowserWarning = signal(false);
  protected showPermissionMessage = signal(false);
  protected isFrontCamera = signal(false);
  private html5QrCode: Html5Qrcode | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly passwordManagerService: PasswordManagerService,
    private cdr: ChangeDetectorRef,
    private messagePopupService: MessagePopupService,
  ) {
    this.passwordForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.stopScanning();
  }

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

      this.messagePopupService.showSuccess('Password has been set successfully');
      // Store password (e.g., encrypted)
      this.router.navigate(['/login']);
    } else {
      this.messagePopupService.showError('Please correct the errors in the form.');
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

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (/Edg/.test(ua)) return 'Edge';
    if (/Chrome/.test(ua)) return 'Chrome';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/Safari/.test(ua)) return 'Safari';
    if (/Opera|OPR/.test(ua)) return 'Opera';
    return 'Unknown';
  }

  private isBrowserSupported(): boolean {
    const browser = this.getBrowser();
    const isIOS = this.isIOS();

    // iOS specific checks
    if (isIOS) {
      // iOS 15.1+ supports all browsers
      const iosVersion = parseInt(navigator.userAgent.match(/OS (\d+)_/)?.[1] || '0');
      if (iosVersion >= 15) return true;
      
      // For iOS < 15.1, only Safari is fully supported
      return browser === 'Safari';
    }

    // Android checks
    if (this.isMobileDevice()) {
      // Opera Mini and UC Browser have partial support
      if (browser === 'Opera' && /Mini/.test(navigator.userAgent)) return false;
      if (browser === 'UC') return false;
    }

    // All other browsers are supported
    return true;
  }

  private shouldShowBrowserWarning(): boolean {
    return !this.isBrowserSupported();
  }

  importFromQrCode() {
    if (this.shouldShowBrowserWarning()) {
      this.showBrowserWarning.set(true);
      return;
    }
    this.startQrScanning();
  }

  async startQrScanning() {
    this.isScanningMode.set(true);
    this.isScanning.set(true);
    this.showPermissionMessage.set(true);
    this.cdr.detectChanges();

    // Initialize HTML5-QRCode
    this.html5QrCode = new Html5Qrcode("qr-reader");
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        // Start with back camera by default
        const cameraId = devices.find(d => d.label.toLowerCase().includes('back'))?.id || devices[0].id;
        this.isFrontCamera.set(cameraId.toLowerCase().includes('front'));

        await this.html5QrCode.start(
          cameraId,
          config,
          (decodedText) => {
            this.showPermissionMessage.set(false);
            this.stopScanning();
            this.importWalletsData(decodedText);
          },
          (errorMessage) => {
            console.error(errorMessage);
            if (errorMessage.includes('Permission denied')) {
              this.showPermissionMessage.set(true);
            } else {
              // Hide permission message for other errors
              this.showPermissionMessage.set(false);
            }
          }
        );
        // Hide permission message if camera starts successfully
        this.showPermissionMessage.set(false);
      }
    } catch (err) {
      this.messagePopupService.showError('Failed to start camera: ' + err);
      this.stopScanning();
    }
  }

  async stopScanning() {
    if (this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
      } catch (err) {
        console.error(err);
      }

      this.html5QrCode = null;
    }
    this.isScanning.set(false);
    this.isScanningMode.set(false);
    this.showPermissionMessage.set(false);
  }

  afterWarning(proceed: boolean) {
    this.showBrowserWarning.set(false);
    if (proceed) {
      this.startQrScanning();
    }
  }

  backToPasswordForm() {
    this.stopScanning();
  }

  importWalletsData(data: string) {
    this.passwordManagerService.importFromEncryptedData(data);
    this.messagePopupService.showSuccess('Wallets imported successfully')
    this.router.navigate(['/login']);
  }

  importFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.key';

    input.addEventListener('change', (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        this.importWalletsData(ev.target.result);
      };
      reader.readAsText(file);
    });

    input.click();
  }
}
