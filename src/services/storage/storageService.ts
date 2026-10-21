import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Password, PasswordCategory } from '../../models/Password';
import { UserPreferences, UserMasterKey } from '../../models/User';
import { Note } from '../../models/Note';
import { NotificationType } from '../../services/utils/notificationService';
import * as CryptoService from '../../services/crypto/cryptoService';
import Logger from '../../utils/logger';
import { bytesToHex, getRandomBytes } from '../../utils/cryptoRandom';

// Storage Keys
const STORAGE_KEYS = {
  USER_PREFERENCES: 'keysoft_user_preferences',
  PASSWORDS: 'keysoft_passwords',
  CATEGORIES: 'keysoft_categories',
  NOTES: 'keysoft_notes',
  MASTER_KEY_INFO_SECURE: 'keysoft_master_key_info',
};

const ASYNC_STORAGE_KEYS = [
  STORAGE_KEYS.USER_PREFERENCES,
  STORAGE_KEYS.PASSWORDS,
  STORAGE_KEYS.CATEGORIES,
  STORAGE_KEYS.NOTES,
];

// Limits
export const MAX_PASSWORDS_LIMIT = 1000;

// Default Preferences
const defaultUserPreferences: UserPreferences = {
  autoLockTimeout: 60,
  biometricsEnabled: false,
  clipboardClearTimeout: 60,
  language: 'it',
  passwordGeneratorSettings: {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilarCharacters: false,
  },
  screenshotProtectionEnabled: false,
  notificationSettings: {
    [NotificationType.PASSWORD_EXPIRY]: true,
    [NotificationType.WEAK_PASSWORD]: true,
    [NotificationType.DUPLICATE_PASSWORD]: true,
    [NotificationType.AUTO_LOCK_WARNING]: true,
    [NotificationType.CLIPBOARD_CLEAR_WARNING]: true,
    [NotificationType.LOGIN_SUCCESS]: true,
    [NotificationType.LOGIN_FAILURE]: true,
    [NotificationType.BACKUP_REMINDER]: true,
    [NotificationType.BACKUP_SUCCESS]: true,
  },
  username: 'Utente',
  hasPromptedForBiometrics: false,
};

function cloneUserPreferences(preferences: UserPreferences): UserPreferences {
  return {
    ...preferences,
    passwordGeneratorSettings: { ...preferences.passwordGeneratorSettings },
    notificationSettings: preferences.notificationSettings
      ? { ...preferences.notificationSettings }
      : undefined,
    lastNotificationChecks: preferences.lastNotificationChecks
      ? { ...preferences.lastNotificationChecks }
      : undefined,
  };
}

function mergeUserPreferences(stored: Partial<UserPreferences>): UserPreferences {
  return cloneUserPreferences({
    ...defaultUserPreferences,
    ...stored,
    passwordGeneratorSettings: {
      ...defaultUserPreferences.passwordGeneratorSettings,
      ...(stored.passwordGeneratorSettings ?? {}),
    },
    notificationSettings: {
      ...defaultUserPreferences.notificationSettings,
      ...(stored.notificationSettings ?? {}),
    },
  });
}

// In-memory cache
interface CacheData {
  passwords: Password[];
  categories: PasswordCategory[];
  notes: Note[];
  userPreferences: UserPreferences;
  masterKeyInfo: UserMasterKey | null;
}

const cache: CacheData = {
  passwords: [],
  categories: [],
  notes: [],
  userPreferences: cloneUserPreferences(defaultUserPreferences),
  masterKeyInfo: null,
};

let encryptionKey: string | null = null;
const decryptionErrors = {
  passwords: false,
  notes: false,
};

// --- Serialised collection writes ---

// Every mutation below rebuilds a whole collection from the shared in-memory cache and
// overwrites its AsyncStorage record. Two mutations that start from the same snapshot
// would make the last writer silently drop the other operation's change, leaving the
// cache and the persisted record disagreeing. Each storage key owns a FIFO mutex; a
// mutation runs only after the previous mutation on the same key settled. Operations
// that touch more than one collection acquire their mutexes in a fixed order, so they
// cannot deadlock.
class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const storageMutexes = new Map<string, AsyncMutex>();

function getStorageMutex(storageKey: string): AsyncMutex {
  let mutex = storageMutexes.get(storageKey);
  if (!mutex) {
    mutex = new AsyncMutex();
    storageMutexes.set(storageKey, mutex);
  }
  return mutex;
}

async function withStorageLocks<T>(
  storageKeys: readonly string[],
  operation: () => Promise<T>,
): Promise<T> {
  const orderedMutexes = [...new Set(storageKeys)].sort().map(getStorageMutex);

  const acquire = async (index: number): Promise<T> => {
    if (index >= orderedMutexes.length) {
      return operation();
    }
    return orderedMutexes[index].runExclusive(() => acquire(index + 1));
  };

  return acquire(0);
}

function generateStorageId(): string {
  return `${Date.now().toString(36)}_${bytesToHex(getRandomBytes(8))}`;
}

// --- Re-encryption for Password Change ---

export const reEncryptAllData = async (newKey: string): Promise<void> => {
  Logger.debug('StorageService: Starting re-encryption of all data...');

  if (!newKey) {
    throw new Error('New encryption key cannot be empty');
  }
  if (decryptionErrors.passwords || decryptionErrors.notes) {
    throw new Error('Cannot re-encrypt data due to prior decryption errors');
  }

  try {
    // Lock both collections: a concurrent save on either one must run before or after
    // the rekey, never against the previous key while the vault is being re-encrypted.
    await withStorageLocks([STORAGE_KEYS.PASSWORDS, STORAGE_KEYS.NOTES], async () => {
      // Compute both ciphertexts before the storage operation so an encryption
      // failure cannot leave only half of the vault on the new key.
      const [encryptedPasswords, encryptedNotes] = await Promise.all([
        CryptoService.encrypt(JSON.stringify(cache.passwords), newKey),
        CryptoService.encrypt(JSON.stringify(cache.notes), newKey),
      ]);

      // AsyncStorage.multiSet is a single transaction on Android, so a process kill
      // cannot persist only one collection. The in-memory key changes only afterwards.
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.PASSWORDS, encryptedPasswords],
        [STORAGE_KEYS.NOTES, encryptedNotes],
      ]);
      encryptionKey = newKey;
    });
  } catch (error) {
    Logger.error('StorageService: Error re-encrypting vault data', error);
    throw new Error('Failed to re-encrypt vault data');
  }

  Logger.info('StorageService: Data re-encryption completed successfully');
};

// --- Biometric Key Management ---

const BIOMETRIC_KEY_STORAGE = 'keysoft_biometric_key';
const biometricKeyOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Autenticati per accedere a Keysoft',
};

function assertBiometricKeyFormat(key: string): void {
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('Invalid biometric key format');
  }
}

export const saveBiometricKey = async (key: string): Promise<void> => {
  try {
    assertBiometricKeyFormat(key);
    await SecureStore.setItemAsync(BIOMETRIC_KEY_STORAGE, key, biometricKeyOptions);
    Logger.debug('StorageService: Biometric key saved');
  } catch (error) {
    Logger.error('StorageService: Error saving biometric key', error);
    throw error;
  }
};

export const getBiometricKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(BIOMETRIC_KEY_STORAGE, biometricKeyOptions);
  } catch (error) {
    Logger.error('StorageService: Error reading biometric key', error);
    throw error;
  }
};

export const deleteBiometricKey = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORAGE);
    Logger.debug('StorageService: Biometric key deleted');
  } catch (error) {
    Logger.error('StorageService: Error deleting biometric key', error);
  }
};

// --- Initialization ---

export const initDatabase = async (): Promise<void> => {
  Logger.debug('StorageService: Initializing database...');
  try {
    await loadDataFromStorage();
    Logger.info('StorageService: Database initialized successfully');
  } catch (error) {
    Logger.error('StorageService: Error initializing database', error);
    throw error;
  }
};

const loadDataFromStorage = async (): Promise<void> => {
  try {
    decryptionErrors.passwords = false;
    decryptionErrors.notes = false;

    // Reuse secure metadata already loaded during startup instead of reading
    // SecureStore again for every unlock.
    if (!cache.masterKeyInfo) {
      const masterKeyInfoJson = await SecureStore.getItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
      if (masterKeyInfoJson) {
        cache.masterKeyInfo = JSON.parse(masterKeyInfoJson);
        Logger.debug('StorageService: Master key info loaded');
      }
    }

    // While locked, encrypted vault blobs are not useful. Once a verified key is
    // available, fetch all AsyncStorage records in one native round trip.
    const requestedKeys = encryptionKey
      ? [
          STORAGE_KEYS.USER_PREFERENCES,
          STORAGE_KEYS.PASSWORDS,
          STORAGE_KEYS.CATEGORIES,
          STORAGE_KEYS.NOTES,
        ]
      : [STORAGE_KEYS.USER_PREFERENCES, STORAGE_KEYS.CATEGORIES];
    const storedEntries = new Map(await AsyncStorage.multiGet(requestedKeys));

    const userPreferencesJson = storedEntries.get(STORAGE_KEYS.USER_PREFERENCES);
    if (userPreferencesJson) {
      const storedPrefs = JSON.parse(userPreferencesJson) as Partial<UserPreferences>;
      cache.userPreferences = mergeUserPreferences(storedPrefs);
      if (!cache.userPreferences.language) {
        cache.userPreferences.language = 'it';
      }
      Logger.debug('StorageService: User preferences loaded');
    }

    const categoriesJson = storedEntries.get(STORAGE_KEYS.CATEGORIES);
    if (categoriesJson) {
      cache.categories = JSON.parse(categoriesJson);
    }

    if (!encryptionKey) {
      return;
    }

    let shouldPersistPasswords = false;
    const passwordsJson = storedEntries.get(STORAGE_KEYS.PASSWORDS);
    if (passwordsJson) {
      if (!passwordsJson.trim().startsWith('[')) {
        try {
          const decrypted = await CryptoService.decrypt(passwordsJson, encryptionKey);
          cache.passwords = JSON.parse(decrypted);
          Logger.debug('StorageService: Encrypted passwords loaded');
        } catch (e) {
          Logger.error('StorageService: Error decrypting passwords', e);
          decryptionErrors.passwords = true;
          cache.passwords = [];
        }
      } else if (passwordsJson.trim().startsWith('[')) {
        cache.passwords = JSON.parse(passwordsJson);
        Logger.debug('StorageService: Legacy plaintext passwords loaded for migration');
        shouldPersistPasswords = true;
      }
    }

    if (!decryptionErrors.passwords && migratePasswordCategories(cache.passwords)) {
      shouldPersistPasswords = true;
    }

    if (shouldPersistPasswords && !decryptionErrors.passwords) {
      await withStorageLocks([STORAGE_KEYS.PASSWORDS], async () => {
        const activeKey = encryptionKey;
        if (!activeKey) return;
        const encryptedPasswords = await CryptoService.encrypt(
          JSON.stringify(cache.passwords),
          activeKey,
        );
        await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encryptedPasswords);
      });
      Logger.info('StorageService: Password storage migrated in one atomic write');
    }

    const notesJson = storedEntries.get(STORAGE_KEYS.NOTES);
    if (notesJson) {
      if (!notesJson.trim().startsWith('[')) {
        try {
          const decrypted = await CryptoService.decrypt(notesJson, encryptionKey);
          cache.notes = JSON.parse(decrypted);
        } catch (e) {
          Logger.error('StorageService: Error decrypting notes', e);
          decryptionErrors.notes = true;
          cache.notes = [];
        }
      } else if (notesJson.trim().startsWith('[')) {
        cache.notes = JSON.parse(notesJson);
        await withStorageLocks([STORAGE_KEYS.NOTES], async () => {
          const activeKey = encryptionKey;
          if (!activeKey) return;
          const encryptedNotes = await CryptoService.encrypt(
            JSON.stringify(cache.notes),
            activeKey,
          );
          await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encryptedNotes);
        });
        Logger.info('StorageService: Legacy plaintext notes migrated to encrypted storage');
      }
    }
  } catch (error) {
    Logger.error('StorageService: Error loading data from storage', error);
    throw error;
  }
};

// --- Master Key & Encryption ---

export const saveMasterKeyInfo = async (masterKeyInfo: UserMasterKey): Promise<void> => {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEYS.MASTER_KEY_INFO_SECURE,
      JSON.stringify(masterKeyInfo),
    );
    cache.masterKeyInfo = masterKeyInfo;
    Logger.info('StorageService: Master key info saved');
  } catch (error) {
    Logger.error('StorageService: Error saving master key info', error);
    throw error;
  }
};

export const getMasterKeyInfo = async (): Promise<UserMasterKey | null> => {
  if (!cache.masterKeyInfo) {
    // Try to reload if missing (e.g. app restart)
    const json = await SecureStore.getItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
    if (json) {
      cache.masterKeyInfo = JSON.parse(json);
    }
  }
  return cache.masterKeyInfo;
};

export const deleteMasterKeyInfo = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
  cache.masterKeyInfo = null;
};

// --- Crash-safe master-key migration ---

const PENDING_MASTER_KEY_MIGRATION_SECURE = 'keysoft_pending_master_key_info';

export interface PendingMasterKeyMigration {
  masterKeyInfo: UserMasterKey;
  startedAt: number;
}

function isMasterKeyInfoShape(value: unknown): value is UserMasterKey {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<UserMasterKey>;
  return (
    typeof candidate.salt === 'string' &&
    candidate.salt.length > 0 &&
    typeof candidate.verifier === 'string' &&
    candidate.verifier.length > 0 &&
    Number.isSafeInteger(candidate.iterations) &&
    Number.isSafeInteger(candidate.memory)
  );
}

/**
 * Records the metadata the vault is about to be re-encrypted with before the vault
 * write starts. The active metadata keeps describing the previous key until the
 * migration is committed, so a crash at any point leaves at least one password that
 * can still be used to open the vault.
 */
export const savePendingMasterKeyMigration = async (
  migration: PendingMasterKeyMigration,
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(PENDING_MASTER_KEY_MIGRATION_SECURE, JSON.stringify(migration));
    Logger.info('StorageService: Pending master-key migration recorded');
  } catch (error) {
    Logger.error('StorageService: Error saving pending master-key migration', error);
    throw error;
  }
};

export const getPendingMasterKeyMigration = async (): Promise<PendingMasterKeyMigration | null> => {
  try {
    const json = await SecureStore.getItemAsync(PENDING_MASTER_KEY_MIGRATION_SECURE);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as Partial<PendingMasterKeyMigration> | null;
    if (
      !parsed ||
      !isMasterKeyInfoShape(parsed.masterKeyInfo) ||
      typeof parsed.startedAt !== 'number' ||
      !Number.isSafeInteger(parsed.startedAt)
    ) {
      Logger.warn('StorageService: Ignoring a malformed pending master-key migration record');
      return null;
    }

    return { masterKeyInfo: parsed.masterKeyInfo, startedAt: parsed.startedAt };
  } catch (error) {
    // A transient read failure is reported as "no recovery record" instead of blocking
    // the app: the stored metadata and vault either open normally, or login fails without
    // mutating anything and the recovery record is still there on the next attempt.
    Logger.error('StorageService: Error reading pending master-key migration', error);
    return null;
  }
};

export const deletePendingMasterKeyMigration = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(PENDING_MASTER_KEY_MIGRATION_SECURE);
    Logger.debug('StorageService: Pending master-key migration cleared');
  } catch (error) {
    // A stale recovery record is harmless: the next password login reconciles it.
    Logger.error('StorageService: Error deleting pending master-key migration', error);
  }
};

/**
 * Reports whether the persisted vault records can be decrypted with `key`, without
 * touching the decrypted cache or the active key. Crash recovery uses it to decide
 * which of the two known derivations actually encrypted the vault.
 */
export const canDecryptVaultWithKey = async (key: string): Promise<boolean> => {
  const vaultKeys = [STORAGE_KEYS.PASSWORDS, STORAGE_KEYS.NOTES];
  const entries = new Map(await AsyncStorage.multiGet(vaultKeys));

  for (const storageKey of vaultKeys) {
    const record = entries.get(storageKey);
    if (!record || record.trim().startsWith('[')) {
      // Missing collections and legacy plaintext records do not depend on the key.
      continue;
    }

    try {
      await CryptoService.decrypt(record, key);
    } catch {
      return false;
    }
  }

  return true;
};

export const setEncryptionKey = (key: string): void => {
  if (!key) {
    encryptionKey = null;
    return;
  }

  encryptionKey = key;
  // We do NOT save the encryption key to storage for security reasons.
  // It stays in memory.
};

export const getEncryptionKey = (): string | null => {
  return encryptionKey;
};

export const isEncryptionKeySet = (): boolean => {
  return !!encryptionKey;
};

// --- Passwords ---

export const getPasswordCount = async (): Promise<number> => {
  return cache.passwords.length;
};

export const canAddPassword = async (): Promise<boolean> => {
  return cache.passwords.length < MAX_PASSWORDS_LIMIT;
};

export interface BackupImportData {
  passwords?: Password[];
  notes?: Note[];
}

export interface BackupImportResult {
  passwords: number;
  notes: number;
}

function mergeRecordsById<T extends { id: string }>(current: T[], imported: T[]): T[] {
  const merged = [...current];
  const indexesById = new Map(merged.map((record, index) => [record.id, index]));

  for (const record of imported) {
    const existingIndex = indexesById.get(record.id);
    if (existingIndex === undefined) {
      indexesById.set(record.id, merged.length);
      merged.push(record);
    } else {
      merged[existingIndex] = record;
    }
  }

  return merged;
}

/**
 * Encrypts and persists a validated backup in one storage operation. All
 * ciphertext is prepared before writing and caches are updated only after the
 * write succeeds, preventing a failed import from exposing a partial vault in
 * the active session.
 */
export const importBackupData = async (imported: BackupImportData): Promise<BackupImportResult> => {
  const collectionsToLock = [
    ...(imported.passwords ? [STORAGE_KEYS.PASSWORDS] : []),
    ...(imported.notes ? [STORAGE_KEYS.NOTES] : []),
  ];

  return withStorageLocks(collectionsToLock, async () => {
    const activeKey = getEncryptionKeyOrThrow('import backup');
    if (decryptionErrors.passwords || decryptionErrors.notes) {
      throw new Error('Decryption error detected. Cannot import backup safely.');
    }

    const importedPasswords = imported.passwords ?? [];
    const importedNotes = imported.notes ?? [];
    const nextPasswords = mergeRecordsById(cache.passwords, importedPasswords);
    const nextNotes = mergeRecordsById(cache.notes, importedNotes);

    if (nextPasswords.length > MAX_PASSWORDS_LIMIT) {
      throw new Error(`Password limit of ${MAX_PASSWORDS_LIMIT} would be exceeded.`);
    }

    const writes: [string, string][] = [];
    if (imported.passwords) {
      writes.push([
        STORAGE_KEYS.PASSWORDS,
        await CryptoService.encrypt(JSON.stringify(nextPasswords), activeKey),
      ]);
    }
    if (imported.notes) {
      writes.push([
        STORAGE_KEYS.NOTES,
        await CryptoService.encrypt(JSON.stringify(nextNotes), activeKey),
      ]);
    }

    if (writes.length > 0) {
      await AsyncStorage.multiSet(writes);
    }

    if (imported.passwords) cache.passwords = nextPasswords;
    if (imported.notes) cache.notes = nextNotes;

    return {
      passwords: importedPasswords.length,
      notes: importedNotes.length,
    };
  });
};

function getEncryptionKeyOrThrow(action: string, scope?: 'passwords' | 'notes'): string {
  if (scope && decryptionErrors[scope]) {
    throw new Error(`Decryption error detected. Cannot ${action} safely.`);
  }
  if (encryptionKey) return encryptionKey;
  throw new Error(`Encryption key not set. Cannot ${action} securely.`);
}

const checkPasswordLimit = () => {
  if (cache.passwords.length >= MAX_PASSWORDS_LIMIT) {
    throw new Error(`Hai raggiunto il limite massimo di ${MAX_PASSWORDS_LIMIT} password salvate.`);
  }
};

export const savePassword = async (password: Password): Promise<string> => {
  try {
    return await withStorageLocks([STORAGE_KEYS.PASSWORDS], async () => {
      const activeKey = getEncryptionKeyOrThrow('save password', 'passwords');
      const existingIndex = password.id
        ? cache.passwords.findIndex((p) => p.id === password.id)
        : -1;
      const now = Date.now();
      let savedPassword: Password;
      let nextPasswords: Password[];

      if (existingIndex !== -1) {
        savedPassword = {
          ...password,
          updatedAt: now,
        };
        nextPasswords = cache.passwords.map((current, index) =>
          index === existingIndex ? savedPassword : current,
        );
      } else {
        checkPasswordLimit();
        savedPassword = {
          ...password,
          id: password.id || generateStorageId(),
          createdAt: now,
          updatedAt: now,
        };
        nextPasswords = [...cache.passwords, savedPassword];
      }

      const data = JSON.stringify(nextPasswords);
      const encrypted = await CryptoService.encrypt(data, activeKey);
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encrypted);
      cache.passwords = nextPasswords;

      return savedPassword.id;
    });
  } catch (error) {
    Logger.error('StorageService: Error saving password', error);
    throw error;
  }
};

export const getPassword = async (id: string): Promise<Password | null> => {
  const password = cache.passwords.find((p) => p.id === id);
  return password || null;
};

export const getAllPasswords = async (): Promise<Password[]> => {
  return [...cache.passwords];
};

export const getPasswordsPaginated = async (
  limit: number = 50,
  offset: number = 0,
  category?: string,
  searchQuery?: string,
): Promise<{ passwords: Password[]; total: number }> => {
  let filtered = [...cache.passwords];

  if (category) {
    filtered = filtered.filter((password) => password.category === category);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (password) =>
        password.title.toLowerCase().includes(query) ||
        password.username.toLowerCase().includes(query) ||
        (password.website && password.website.toLowerCase().includes(query)) ||
        (password.notes && password.notes.toLowerCase().includes(query)),
    );
  }

  const total = filtered.length;
  const sliced = filtered.slice(offset, offset + limit);
  return { passwords: sliced, total };
};

export const deletePassword = async (id: string): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.PASSWORDS], async () => {
      const activeKey = getEncryptionKeyOrThrow('delete password', 'passwords');
      const nextPasswords = cache.passwords.filter((password) => password.id !== id);

      const data = JSON.stringify(nextPasswords);
      const encrypted = await CryptoService.encrypt(data, activeKey);
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encrypted);
      cache.passwords = nextPasswords;
    });
  } catch (error) {
    Logger.error('StorageService: Error deleting password', error);
    throw error;
  }
};

export const clearAllPasswords = async (): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.PASSWORDS], async () => {
      getEncryptionKeyOrThrow('clear passwords', 'passwords');
      await AsyncStorage.removeItem(STORAGE_KEYS.PASSWORDS);
      cache.passwords = [];
      Logger.info('StorageService: All passwords cleared');
    });
  } catch (error) {
    Logger.error('StorageService: Error clearing passwords', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    await withStorageLocks(ASYNC_STORAGE_KEYS, async () => {
      // Remove only Keysoft-owned records. AsyncStorage can also be used by
      // third-party libraries, so a global clear risks deleting unrelated state.
      await AsyncStorage.multiRemove(ASYNC_STORAGE_KEYS);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
      await SecureStore.deleteItemAsync(PENDING_MASTER_KEY_MIGRATION_SECURE);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORAGE);

      // Reset cache
      cache.passwords = [];
      cache.categories = [];
      cache.notes = [];
      cache.userPreferences = cloneUserPreferences(defaultUserPreferences);
      cache.masterKeyInfo = null;
      encryptionKey = null;
    });

    Logger.info('StorageService: All data cleared');
  } catch (error) {
    Logger.error('StorageService: Error clearing all data', error);
    throw error;
  }
};

// --- Categories ---

export const getCategories = async (): Promise<PasswordCategory[]> => {
  return [...cache.categories];
};

export const createCategory = async (category: Omit<PasswordCategory, 'id'>): Promise<string> => {
  try {
    return await withStorageLocks([STORAGE_KEYS.CATEGORIES], async () => {
      const newCategory: PasswordCategory = {
        ...category,
        id: generateStorageId(),
      };
      const nextCategories = [...cache.categories, newCategory];
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
      cache.categories = nextCategories;
      return newCategory.id;
    });
  } catch (error) {
    Logger.error('StorageService: Error creating category', error);
    throw error;
  }
};

export const updateCategory = async (category: PasswordCategory): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.CATEGORIES], async () => {
      const index = cache.categories.findIndex((c) => c.id === category.id);
      if (index !== -1) {
        const nextCategories = cache.categories.map((current, currentIndex) =>
          currentIndex === index ? category : current,
        );
        await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
        cache.categories = nextCategories;
      }
    });
  } catch (error) {
    Logger.error('StorageService: Error updating category', error);
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.CATEGORIES], async () => {
      const nextCategories = cache.categories.filter((category) => category.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
      cache.categories = nextCategories;
    });
  } catch (error) {
    Logger.error('StorageService: Error deleting category', error);
    throw error;
  }
};

// --- Notes ---

export const saveNote = async (note: Note): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.NOTES], async () => {
      const activeKey = getEncryptionKeyOrThrow('save note', 'notes');
      const existingIndex = cache.notes.findIndex((n) => n.id === note.id);
      const nextNotes =
        existingIndex >= 0
          ? cache.notes.map((current, index) => (index === existingIndex ? note : current))
          : [...cache.notes, note];

      const data = JSON.stringify(nextNotes);
      const encrypted = await CryptoService.encrypt(data, activeKey);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encrypted);
      cache.notes = nextNotes;
    });
  } catch (error) {
    Logger.error('StorageService: Error saving note', error);
    throw error;
  }
};

export const getNotes = async (): Promise<Note[]> => {
  return [...cache.notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
};

export const getNoteById = async (noteId: string): Promise<Note | null> => {
  const note = cache.notes.find((n) => n.id === noteId);
  return note || null;
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.NOTES], async () => {
      const activeKey = getEncryptionKeyOrThrow('delete note', 'notes');
      const nextNotes = cache.notes.filter((note) => note.id !== noteId);

      const data = JSON.stringify(nextNotes);
      const encrypted = await CryptoService.encrypt(data, activeKey);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encrypted);
      cache.notes = nextNotes;
    });
  } catch (error) {
    Logger.error('StorageService: Error deleting note', error);
    throw error;
  }
};

export const clearAllNotes = async (): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.NOTES], async () => {
      getEncryptionKeyOrThrow('clear notes', 'notes');
      await AsyncStorage.removeItem(STORAGE_KEYS.NOTES);
      cache.notes = [];
      Logger.info('StorageService: All notes cleared');
    });
  } catch (error) {
    Logger.error('StorageService: Error clearing notes', error);
    throw error;
  }
};

// --- User Preferences ---

export const getUserPreferences = async (): Promise<UserPreferences> => {
  return cloneUserPreferences(cache.userPreferences);
};

export const saveUserPreferences = async (preferences: UserPreferences): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.USER_PREFERENCES], async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
      cache.userPreferences = cloneUserPreferences(preferences);
      Logger.debug('StorageService: User preferences saved');
    });
  } catch (error) {
    Logger.error('StorageService: Error saving user preferences', error);
    throw error;
  }
};

export const clearPreferences = async (): Promise<void> => {
  try {
    await withStorageLocks([STORAGE_KEYS.USER_PREFERENCES], async () => {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
      cache.userPreferences = cloneUserPreferences(defaultUserPreferences);
      Logger.info('StorageService: Preferences cleared');
    });
  } catch (error) {
    Logger.error('StorageService: Error clearing preferences', error);
    throw error;
  }
};

// --- Helpers ---

const migratePasswordCategories = (passwords: Password[]): boolean => {
  const categoryMapping: Record<string, string> = {
    login: 'email',
    browse: 'shopping',
    card: 'gaming',
  };

  let hasChanges = false;

  for (const password of passwords) {
    const mappedCategory = password.category ? categoryMapping[password.category] : undefined;
    if (!mappedCategory) {
      continue;
    }

    password.category = mappedCategory;
    hasChanges = true;
  }

  return hasChanges;
};
