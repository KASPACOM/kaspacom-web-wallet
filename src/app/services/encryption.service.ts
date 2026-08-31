import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EncryptionService {
  private readonly VERSION_PREFIX = 'v2:';
  private readonly LEGACY_ITERATIONS = 100000;
  private readonly CURRENT_ITERATIONS = 600000;
  // AES-GCM parameters
  private readonly ALGORITHM: string = 'aes-gcm';
  private readonly KEY_LENGTH: number = 256; // AES 256-bit key
  private readonly IV_LENGTH: number = 12; // 12 bytes IV for AES-GCM (recommended)
  private readonly SALT_LENGTH: number = 16; // 16 bytes salt length

  constructor() {}

  /**
   * Derives a cryptographic key from the password and salt using PBKDF2.
   * @param password The password to derive the key from.
   * @param salt The salt used to add randomness to the key derivation.
   */
  private async deriveKey(
    password: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
  ): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Encrypts data with AES-GCM.
   * @param data The data to encrypt.
   * @param password The password to derive the encryption key.
   * @returns The encrypted data as a string.
   */
  async encrypt(data: string, password: string): Promise<string> {
    // Generate a random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    // Derive key from password and salt
    const key = await this.deriveKey(password, salt, this.CURRENT_ITERATIONS);

    // Convert the data to a Uint8Array
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv,
      },
      key,
      dataBuffer,
    );

    // Combine salt, iv, and encrypted data into one array for easy storage
    const encryptedArray = new Uint8Array(
      salt.byteLength + iv.byteLength + encryptedBuffer.byteLength,
    );
    encryptedArray.set(salt);
    encryptedArray.set(iv, salt.byteLength);
    encryptedArray.set(
      new Uint8Array(encryptedBuffer),
      salt.byteLength + iv.byteLength,
    );

    // Return the encrypted data as a base64-encoded string
    return `${this.VERSION_PREFIX}${btoa(String.fromCharCode(...encryptedArray))}`;
  }

  isLegacyEncryptedData(encryptedData: string): boolean {
    return !encryptedData.startsWith(this.VERSION_PREFIX);
  }

  /**
   * Decrypts data with AES-GCM.
   * @param encryptedData The encrypted data as a base64-encoded string.
   * @param password The password to derive the decryption key.
   * @returns The decrypted data as a string.
   */
  async decrypt(encryptedData: string, password: string): Promise<string> {
    const isCurrentVersion = encryptedData.startsWith(this.VERSION_PREFIX);
    const encryptedPayload = isCurrentVersion
      ? encryptedData.slice(this.VERSION_PREFIX.length)
      : encryptedData;

    // Decode the base64-encoded encrypted data
    const encryptedArray = new Uint8Array(
      atob(encryptedPayload)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    // Extract the salt, IV, and encrypted data from the combined array
    const salt = encryptedArray.slice(0, this.SALT_LENGTH);
    const iv = encryptedArray.slice(
      this.SALT_LENGTH,
      this.SALT_LENGTH + this.IV_LENGTH,
    );
    const encryptedBuffer = encryptedArray.slice(
      this.SALT_LENGTH + this.IV_LENGTH,
    );

    // Derive the decryption key using the password and the salt
    const key = await this.deriveKey(
      password,
      salt,
      isCurrentVersion ? this.CURRENT_ITERATIONS : this.LEGACY_ITERATIONS,
    );

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv,
      },
      key,
      encryptedBuffer,
    );

    // Convert the decrypted buffer to a string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
}
