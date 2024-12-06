import { Injectable } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { EncryptionService } from './encryption.service';
import { UserWalletsData } from '../types/user-wallets-data';
import { version } from '../../../package.json';
import { UtilsHelper } from './utils.service';

@Injectable({
  providedIn: 'root',
})
export class PasswordManagerService {
  private password: string | null = null;

  constructor(
    private readonly encryptionService: EncryptionService,
    private utils: UtilsHelper
  ) {}

  isUserHasSavedPassword(): boolean {
    return !!localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);
  }

  async setSavedPassword(
    password: string,
    force: boolean = false
  ): Promise<void> {
    if (localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA) && !force) {
      throw new Error('Password already set');
    }

    await this.saveWalletsData(this.getInitializedWalletsData(), password);
  }

  async checkPassword(password: string): Promise<boolean> {
    return !!(await this.getUserDataWithPassword(password));
  }

  importFromQr(encryptedUserData: string): boolean {
    const encryptedMessage = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);

    if (encryptedMessage) {
      throw new Error('Data already found');
    }

    localStorage.setItem(LOCAL_STORAGE_KEYS.USER_DATA, encryptedUserData);

    return true;
  }

  async getUserDataWithPassword(
    password: string
  ): Promise<UserWalletsData | null> {
    const encryptedMessage = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);

    if (!encryptedMessage) {
      return null;
    }

    try {
      const UserDataJson = await this.encryptionService.decrypt(
        encryptedMessage,
        password
      );

      if (UserDataJson) {

        const userData: UserWalletsData = JSON.parse(UserDataJson);
        
        if (userData.version) {
          return userData;
        }

        return null;
      }
    } catch (error) {
      console.error('Error decrypting data:', error);
      return null;
    }

    return null;
  }

  async checkAndLoadPassword(password: string): Promise<boolean> {
    const userData = await this.getUserDataWithPassword(password);

    if (!userData) {
      return false;
    }

    this.password = password;

    return true;
  }

  async getUserData(): Promise<UserWalletsData> {
    const userData = await this.getUserDataWithPassword(this.password!);

    if (!userData) {
      throw new Error('User data not found');
    }

    return userData;
  }

  getInitializedWalletsData(): UserWalletsData {
    return {
      wallets: [],
      version,
    };
  }

  async saveWalletsData(
    walletsData: UserWalletsData,
    password: string
  ): Promise<boolean> {
    if (!password || this.utils.isNullOrEmptyString(password)) {
      return false;
    }

    const encryptedMessage = await this.encryptionService.encrypt(
      JSON.stringify(walletsData),
      password
    );

    localStorage.setItem(LOCAL_STORAGE_KEYS.USER_DATA, encryptedMessage);
    return true;
  }

  async saveWalletsDataWithStoredPassword(
    walletsData: UserWalletsData
  ): Promise<boolean> {
    if (!this.password) {
      return false;
    }

    return this.saveWalletsData(walletsData, this.password);
  }
}
