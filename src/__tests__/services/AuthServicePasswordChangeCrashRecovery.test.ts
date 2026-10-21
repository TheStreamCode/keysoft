import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../../services/auth/authService';
import * as StorageService from '../../services/storage/storageService';
import * as CryptoService from '../../services/crypto/cryptoService';
import { Password } from '../../models/Password';
import { UserMasterKey } from '../../models/User';

// The native KDF is mocked globally in jest.setup.js. This suite replaces its
// implementation with a deterministic 256-bit derivation so the real CryptoService
// (Argon2 metadata path, KS1 encryption) can run end-to-end in Jest.
const argon2Mock = jest.requireMock('react-native-argon2') as { argon2: jest.Mock };

// --- Simulated device storage ---------------------------------------------------------
// Records live in Maps so a test can simulate a process kill: module memory is lost,
// the device storage survives and a fresh login has to recover from it.

const MASTER_KEY_INFO_STORAGE_KEY = 'keysoft_master_key_info';
const PENDING_MIGRATION_STORAGE_KEY = 'keysoft_pending_master_key_info';
const PASSWORDS_STORAGE_KEY = 'keysoft_passwords';
const NOTES_STORAGE_KEY = 'keysoft_notes';

const mockAsyncStorageRecords = new Map<string, string>();
const mockSecureStoreRecords = new Map<string, string>();
let mockCrashOnSecureStoreKey: string | null = null;
let mockCrashPointReached = false;

function installDeterministicArgon2(): void {
  argon2Mock.argon2.mockImplementation(
    async (password: string, salt: string, options?: { iterations?: number }) => {
      const hash = CryptoJS.PBKDF2(`${password}:${salt}`, 'keysoft-test-kdf', {
        keySize: 256 / 32,
        iterations: Math.max(1, options?.iterations ?? 1),
      });
      return { rawHash: hash.toString(CryptoJS.enc.Hex) };
    },
  );
}

function installMockStorage(): void {
  const asyncStorage = AsyncStorage as unknown as {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    multiGet: jest.Mock;
    multiSet: jest.Mock;
    multiRemove: jest.Mock;
  };

  asyncStorage.getItem.mockImplementation(
    async (key: string) => mockAsyncStorageRecords.get(key) ?? null,
  );
  asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
    mockAsyncStorageRecords.set(key, value);
  });
  asyncStorage.removeItem.mockImplementation(async (key: string) => {
    mockAsyncStorageRecords.delete(key);
  });
  asyncStorage.multiGet.mockImplementation(async (keys: string[]) =>
    keys.map((key) => [key, mockAsyncStorageRecords.get(key) ?? null] as [string, string | null]),
  );
  asyncStorage.multiSet.mockImplementation(async (pairs: [string, string][]) => {
    for (const [key, value] of pairs) {
      mockAsyncStorageRecords.set(key, value);
    }
  });
  asyncStorage.multiRemove.mockImplementation(async (keys: string[]) => {
    for (const key of keys) {
      mockAsyncStorageRecords.delete(key);
    }
  });

  const secureStore = SecureStore as unknown as {
    getItemAsync: jest.Mock;
    setItemAsync: jest.Mock;
    deleteItemAsync: jest.Mock;
  };

  secureStore.getItemAsync.mockImplementation(
    async (key: string) => mockSecureStoreRecords.get(key) ?? null,
  );
  secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
    if (mockCrashOnSecureStoreKey === key) {
      mockCrashOnSecureStoreKey = null;
      mockCrashPointReached = true;
      // Never settles: the process is killed before this write reaches the disk.
      return new Promise<void>(() => {});
    }
    mockSecureStoreRecords.set(key, value);
  });
  secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
    mockSecureStoreRecords.delete(key);
  });
}

const seededPassword: Password = {
  id: 'seeded-password',
  title: 'Seeded account',
  username: 'user',
  password: 'secret-value',
  createdAt: 1,
  updatedAt: 1,
};

async function deriveKeyFor(masterKeyInfo: UserMasterKey, password: string): Promise<string> {
  return CryptoService.deriveKey(
    password,
    masterKeyInfo.salt,
    masterKeyInfo.iterations,
    masterKeyInfo.memory,
  );
}

async function seedCurrentVault(
  masterPassword: string,
): Promise<{ masterKeyInfo: UserMasterKey; vaultKey: string }> {
  const { masterKeyInfo, derivedKey: vaultKey } =
    await CryptoService.createMasterKeyInfoWithDerivedKey(masterPassword);

  mockSecureStoreRecords.set(MASTER_KEY_INFO_STORAGE_KEY, JSON.stringify(masterKeyInfo));
  mockAsyncStorageRecords.set(
    PASSWORDS_STORAGE_KEY,
    await CryptoService.encrypt(JSON.stringify([seededPassword]), vaultKey),
  );
  mockAsyncStorageRecords.set(
    NOTES_STORAGE_KEY,
    await CryptoService.encrypt(JSON.stringify([]), vaultKey),
  );

  return { masterKeyInfo, vaultKey };
}

function readPendingMigration(): { masterKeyInfo: UserMasterKey; startedAt: number } | null {
  const json = mockSecureStoreRecords.get(PENDING_MIGRATION_STORAGE_KEY);
  return json ? (JSON.parse(json) as { masterKeyInfo: UserMasterKey; startedAt: number }) : null;
}

async function waitForSimulatedCrash(): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (mockCrashPointReached) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Simulated crash point was not reached');
}

describe('AuthService master password change crash recovery', () => {
  const oldPassword = 'old master password';
  const newPassword = 'new master password';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAsyncStorageRecords.clear();
    mockSecureStoreRecords.clear();
    mockCrashOnSecureStoreKey = null;
    mockCrashPointReached = false;
    installDeterministicArgon2();
    installMockStorage();
    await AuthService.logout();
    await StorageService.clearAllData();
  });

  it('accepts the new password after a crash between the vault write and the metadata commit', async () => {
    const seeded = await seedCurrentVault(oldPassword);
    await expect(AuthService.loginWithMasterPassword(oldPassword)).resolves.toBe(true);

    // Kill the process at the metadata commit, after the vault was re-encrypted.
    mockCrashOnSecureStoreKey = MASTER_KEY_INFO_STORAGE_KEY;
    const crashedUpdate = AuthService.updateMasterPassword(newPassword);
    void crashedUpdate.catch(() => undefined);
    await waitForSimulatedCrash();

    const pendingMigration = readPendingMigration();
    expect(pendingMigration).not.toBeNull();
    const pendingKey = await deriveKeyFor(
      (pendingMigration as { masterKeyInfo: UserMasterKey }).masterKeyInfo,
      newPassword,
    );
    await expect(StorageService.canDecryptVaultWithKey(pendingKey)).resolves.toBe(true);
    await expect(StorageService.canDecryptVaultWithKey(seeded.vaultKey)).resolves.toBe(false);

    // Simulated process restart: only device storage survives.
    await AuthService.logout();

    // Trying the previous password first must not destroy the recovery record; recovery
    // reports which password is needed instead of silently failing with "invalid PIN".
    await expect(AuthService.loginWithMasterPassword(oldPassword)).resolves.toBe(false);
    expect(AuthService.getLastAuthFailure()?.reason).toBe('kdf_recovery_requires_new_password');
    expect(readPendingMigration()).not.toBeNull();

    await expect(AuthService.loginWithMasterPassword(newPassword)).resolves.toBe(true);
    expect(readPendingMigration()).toBeNull();
    expect(JSON.parse(mockSecureStoreRecords.get(MASTER_KEY_INFO_STORAGE_KEY) as string)).toEqual(
      (pendingMigration as { masterKeyInfo: UserMasterKey }).masterKeyInfo,
    );
    expect((await StorageService.getAllPasswords()).map((record) => record.id)).toEqual([
      seededPassword.id,
    ]);

    // The change is committed: the previous password is no longer accepted.
    await AuthService.logout();
    await expect(AuthService.loginWithMasterPassword(oldPassword)).resolves.toBe(false);
  });

  it('rolls back a recovery record whose vault write never happened', async () => {
    const seeded = await seedCurrentVault(oldPassword);
    const { masterKeyInfo: pendingMasterKeyInfo } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(newPassword);

    // Durable state of a crash after the recovery record was written and before the
    // vault write: the previous metadata and ciphertext are still the active ones.
    mockSecureStoreRecords.set(
      PENDING_MIGRATION_STORAGE_KEY,
      JSON.stringify({ masterKeyInfo: pendingMasterKeyInfo, startedAt: Date.now() }),
    );

    await expect(AuthService.loginWithMasterPassword(oldPassword)).resolves.toBe(true);

    expect(readPendingMigration()).toBeNull();
    expect(JSON.parse(mockSecureStoreRecords.get(MASTER_KEY_INFO_STORAGE_KEY) as string)).toEqual(
      seeded.masterKeyInfo,
    );
    await expect(StorageService.canDecryptVaultWithKey(seeded.vaultKey)).resolves.toBe(true);

    // The never-committed change is discarded, so the new password is not active.
    await AuthService.logout();
    await expect(AuthService.loginWithMasterPassword(newPassword)).resolves.toBe(false);
  });
});
