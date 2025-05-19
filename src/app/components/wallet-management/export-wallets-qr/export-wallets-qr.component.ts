import { NgIf } from '@angular/common';
import { Component, signal } from '@angular/core';
import { QRCodeModule } from 'angularx-qrcode';
import { PasswordManagerService } from '../../../services/password-manager.service';
import { LOCAL_STORAGE_KEYS } from '../../../config/consts';


@Component({
  selector: 'export-wallets-qr',
  standalone: true,
  templateUrl: './export-wallets-qr.component.html',
  styleUrls: ['./export-wallets-qr.component.scss'],
  imports: [NgIf, QRCodeModule],
})
export class ExportWalletsQrComponent {
  showPasswordPrompt: boolean = false; // Signal to display the password prompt
  passwordFilled: boolean = false; // Signal to display the QR code
  encryptedUserData: string | null = null;
  maxDataLength = 2331;

  constructor(private passwordManagerService: PasswordManagerService) {}

  handleButtonClick() {
    this.showPasswordPrompt = true;
  }

  async verifyPassword(inputPassword: string) {
    if (await this.passwordManagerService.checkPassword(inputPassword)) {
      this.passwordFilled = true;
      this.showPasswordPrompt = false;

      const encryptedUserData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);


      if (encryptedUserData) {
        this.encryptedUserData = encryptedUserData;
      }

    } else {
      alert('Incorrect password. Please try again.');
    }
  }

  hideKeyInfo() {
    this.passwordFilled = false;
    this.encryptedUserData = null;
  }

  downloadKeyFile() {
    const link = document.createElement('a');
    link.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(this.encryptedUserData!)}`);
    link.setAttribute('download', 'kaspacom-wallets.key');

    link.style.display = 'none';
    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  }
}
