import { TestBed } from '@angular/core/testing';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { UtilsHelper } from './utils.service';
import { EncryptionService } from './encryption.service';
import { PasswordManagerService } from './password-manager.service';

describe('PasswordManagerService', () => {
  let service: PasswordManagerService;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UtilsHelper,
          useValue: { isNullOrEmptyString: (value: string) => !value },
        },
      ],
    });
    service = TestBed.inject(PasswordManagerService);
    encryptionService = TestBed.inject(EncryptionService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores imported legacy wallet data and migrates it after a successful password unlock', async () => {
    const legacyData = await encryptLegacyPayload(
      JSON.stringify({
        wallets: [],
        version: 'legacy',
        id: 'wallet-id',
      }),
      'password',
    );

    expect(service.importFromEncryptedData(legacyData)).toBeTrue();
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA)).toBe(legacyData);

    await expectAsync(
      service.getUserDataWithPassword('password'),
    ).toBeResolvedTo(
      jasmine.objectContaining({
        version: 'legacy',
        id: 'wallet-id',
      }),
    );

    const migratedData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);
    expect(migratedData).not.toBe(legacyData);
    expect(migratedData?.startsWith('v2:')).toBeTrue();
    await expectAsync(
      encryptionService.decrypt(migratedData!, 'password'),
    ).toBeResolvedTo(
      JSON.stringify({
        wallets: [],
        version: 'legacy',
        id: 'wallet-id',
      }),
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
