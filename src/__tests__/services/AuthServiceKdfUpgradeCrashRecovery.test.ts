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

async function seedLegacyVault(
  masterPassword: string,
): Promise<{ masterKeyInfo: UserMasterKey; vaultKey: string }> {
  const salt = CryptoService.generateSalt();
  // Legacy metadata: memory = 0 makes the metadata a PBKDF2 vault, which login treats as
  // a KDF upgrade candidate. The low iteration count only keeps the test fast.
  const iterations = 1000;
  const memory = 0;
  const vaultKey = await CryptoService.deriveKey(masterPassword, salt, iterations, memory);
  const masterKeyInfo: UserMasterKey = {
    salt,
    iterations,
    memory,
    verifier: CryptoJS.SHA256(vaultKey).toString(),
  };

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

async function waitForSimulatedCrash(): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (mockCrashPointReached) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Simulated crash point was not reached');
}

describe('AuthService transparent KDF upgrade crash recovery', () => {
  const masterPassword = 'correct horse battery staple';

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

  it('opens the vault after a crash between the vault write and the metadata commit', async () => {
    const seeded = await seedLegacyVault(masterPassword);

    // Kill the process at the metadata commit, after the re-encrypted vault was written.
    mockCrashOnSecureStoreKey = MASTER_KEY_INFO_STORAGE_KEY;
    const crashedLogin = AuthService.loginWithMasterPassword(masterPassword);
    void crashedLogin.catch(() => undefined);
    await waitForSimulatedCrash();

    const pendingJson = mockSecureStoreRecords.get(PENDING_MIGRATION_STORAGE_KEY);
    expect(pendingJson).toBeDefined();
    const pendingMigration = JSON.parse(pendingJson as string) as {
      masterKeyInfo: UserMasterKey;
      startedAt: number;
    };

    // This is the state that used to lock the user out: the vault uses the new key while
    // the active metadata still describes the legacy one.
    const pendingKey = await deriveKeyFor(pendingMigration.masterKeyInfo, masterPassword);
    await expect(StorageService.canDecryptVaultWithKey(pendingKey)).resolves.toBe(true);
    await expect(StorageService.canDecryptVaultWithKey(seeded.vaultKey)).resolves.toBe(false);
    expect(JSON.parse(mockSecureStoreRecords.get(MASTER_KEY_INFO_STORAGE_KEY) as string)).toEqual(
      seeded.masterKeyInfo,
    );

    // Simulated process restart: only device storage survives.
    await AuthService.logout();

    await expect(AuthService.loginWithMasterPassword(masterPassword)).resolves.toBe(true);

    expect(mockSecureStoreRecords.has(PENDING_MIGRATION_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(mockSecureStoreRecords.get(MASTER_KEY_INFO_STORAGE_KEY) as string)).toEqual(
      pendingMigration.masterKeyInfo,
    );
    expect((await StorageService.getAllPasswords()).map((record) => record.id)).toEqual([
      seededPassword.id,
    ]);
    await expect(StorageService.canDecryptVaultWithKey(pendingKey)).resolves.toBe(true);

    // The recovered metadata still requires a password: the vault is not left unlocked.
    await AuthService.logout();
    expect(AuthService.getIsAuthenticated()).toBe(false);
    await expect(AuthService.loginWithMasterPassword('wrong password')).resolves.toBe(false);
  });
});
