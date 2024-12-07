import { NgIf } from '@angular/common';
import { Component, signal } from '@angular/core';
import { QRCodeComponent, QRCodeModule } from 'angularx-qrcode';
import { PasswordManagerService } from '../../services/password-manager.service';
import { UserWalletsData } from '../../types/user-wallets-data';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';

@Component({
  selector: 'export-wallets-qr',
  standalone: true,
  templateUrl: './export-wallets-qr.component.html',
  styleUrls: ['./export-wallets-qr.component.scss'],
  imports: [NgIf, QRCodeModule],
})
export class ExportWalletsQrComponent {
  showPasswordPrompt = signal(false); // Signal to display the password prompt
  showQrCode = signal(false); // Signal to display the QR code
  encryptedUserData = signal<string | null>(null);

  constructor(private passwordManagerService: PasswordManagerService) {}

  handleButtonClick() {
    this.showPasswordPrompt.set(true);
  }

  async verifyPassword(inputPassword: string) {
    if (await this.passwordManagerService.checkPassword(inputPassword)) {
      this.showQrCode.set(true);
      this.showPasswordPrompt.set(false);

      const encryptedUserData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);

      if (encryptedUserData) {
        this.encryptedUserData.set(encryptedUserData);
      }
    } else {
      alert('Incorrect password. Please try again.');
    }
  }

  hideQr() {
    this.showQrCode.set(false);
    this.encryptedUserData.set(null);
  }
}
