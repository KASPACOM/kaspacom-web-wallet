import { TestBed } from '@angular/core/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncryptionService);
  });

  it('encrypts new payloads with the current version marker', async () => {
    const encrypted = await service.encrypt('wallet-data', 'password');

    expect(encrypted.startsWith('v2:')).toBeTrue();
    await expectAsync(service.decrypt(encrypted, 'password')).toBeResolvedTo(
      'wallet-data',
    );
  });

  it('decrypts legacy unversioned payloads', async () => {
    const encrypted = await encryptLegacyPayload('wallet-data', 'password');

    expect(service.isLegacyEncryptedData(encrypted)).toBeTrue();
    await expectAsync(service.decrypt(encrypted, 'password')).toBeResolvedTo(
      'wallet-data',
    );
  });
});

async function encryptLegacyPayload(
  data: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'aes-gcm', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'aes-gcm', iv },
    key,
    new TextEncoder().encode(data),
  );
  const encryptedArray = new Uint8Array(
    salt.byteLength + iv.byteLength + encryptedBuffer.byteLength,
  );
  encryptedArray.set(salt);
  encryptedArray.set(iv, salt.byteLength);
  encryptedArray.set(
    new Uint8Array(encryptedBuffer),
    salt.byteLength + iv.byteLength,
  );

  return btoa(String.fromCharCode(...encryptedArray));
}
