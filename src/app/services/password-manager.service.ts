import { Injectable } from '@angular/core';
import { ENCRYPTED_MESSAGE_VALUE, LOCAL_STORAGE_KEYS } from '../config/consts';
import { EncryptionService } from './encryption.service';
import { UserWalletsData } from '../types/user-wallets-data';

@Injectable({
  providedIn: 'root',
})
export class PasswordManagerService {
  private password: string | null = null;

  constructor(private readonly encryptionService: EncryptionService) {}

  isUserHasSavedPassword(): boolean {
    return !!localStorage.getItem(LOCAL_STORAGE_KEYS.ENCRYPTED_MESSAGE);
  }

  async setSavedPassword(password: string): Promise<void> {
    const encryptedMessage = await this.encryptionService.encrypt(ENCRYPTED_MESSAGE_VALUE, password);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ENCRYPTED_MESSAGE, encryptedMessage);
  }

  async checkAndLoadPassword(password: string): Promise<boolean> {
    const encryptedMessage = localStorage.getItem(LOCAL_STORAGE_KEYS.ENCRYPTED_MESSAGE);
    if (!encryptedMessage) {
      return false;
    }

    try {
      const decryptedMessage = await this.encryptionService.decrypt(encryptedMessage, password);
    
      if (decryptedMessage === ENCRYPTED_MESSAGE_VALUE) {
        this.password = password;
        return true;
      }
    } catch (error) {
      console.error('Error decrypting message:', error);
      return false;
    }


    return false;
  }
  
  async getWalletsData(): Promise<UserWalletsData> {
    if (!this.password) {
      throw new Error('Password not set');
    }

    const encryptedMessage = localStorage.getItem(LOCAL_STORAGE_KEYS.WALLETS_DATA);
    if (!encryptedMessage) {
      return {
        wallets: [],
      }
    }

    return JSON.parse(await this.encryptionService.decrypt(encryptedMessage, this.password));
  }

  async saveWalletsData(walletsData: UserWalletsData): Promise<boolean> {
    if (!this.password) {
      return false;
    }

    const encryptedMessage = await this.encryptionService.encrypt(JSON.stringify(walletsData), this.password);
    localStorage.setItem(LOCAL_STORAGE_KEYS.WALLETS_DATA, encryptedMessage);
    return true;
  }
}
