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
    const [encryptedPasswords, encryptedNotes] = await Promise.all([
      CryptoService.encrypt(JSON.stringify(cache.passwords), newKey),
      CryptoService.encrypt(JSON.stringify(cache.notes), newKey),
    ]);

    // Compute both ciphertexts before the storage operation so an encryption
    // failure cannot leave only half of the vault on the new key.
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.PASSWORDS, encryptedPasswords],
      [STORAGE_KEYS.NOTES, encryptedNotes],
    ]);
  } catch (error) {
    Logger.error('StorageService: Error re-encrypting vault data', error);
    throw new Error('Failed to re-encrypt vault data');
  }

  encryptionKey = newKey;
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
          Logger.debug(`StorageService: Loaded ${cache.passwords.length} passwords (decrypted)`);
        } catch (e) {
          Logger.error('StorageService: Error decrypting passwords', e);
          decryptionErrors.passwords = true;
          cache.passwords = [];
        }
      } else if (passwordsJson.trim().startsWith('[')) {
        cache.passwords = JSON.parse(passwordsJson);
        Logger.debug(`StorageService: Loaded ${cache.passwords.length} passwords (plain)`);
        shouldPersistPasswords = true;
      }
    }

    if (!decryptionErrors.passwords && migratePasswordCategories(cache.passwords)) {
      shouldPersistPasswords = true;
    }

    if (shouldPersistPasswords && !decryptionErrors.passwords) {
      const encryptedPasswords = await CryptoService.encrypt(
        JSON.stringify(cache.passwords),
        encryptionKey,
      );
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encryptedPasswords);
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
        const encryptedNotes = await CryptoService.encrypt(
          JSON.stringify(cache.notes),
          encryptionKey,
        );
        await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encryptedNotes);
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
    cache.masterKeyInfo = masterKeyInfo;
    await SecureStore.setItemAsync(
      STORAGE_KEYS.MASTER_KEY_INFO_SECURE,
      JSON.stringify(masterKeyInfo),
    );
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
    const activeKey = getEncryptionKeyOrThrow('save password', 'passwords');
    const existingIndex = password.id ? cache.passwords.findIndex((p) => p.id === password.id) : -1;
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
    const activeKey = getEncryptionKeyOrThrow('delete password', 'passwords');
    const nextPasswords = cache.passwords.filter((password) => password.id !== id);

    const data = JSON.stringify(nextPasswords);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encrypted);
    cache.passwords = nextPasswords;
  } catch (error) {
    Logger.error('StorageService: Error deleting password', error);
    throw error;
  }
};

export const clearAllPasswords = async (): Promise<void> => {
  try {
    if (decryptionErrors.passwords) {
      throw new Error('Decryption error detected. Cannot clear passwords safely.');
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.PASSWORDS);
    cache.passwords = [];
    Logger.info('StorageService: All passwords cleared');
  } catch (error) {
    Logger.error('StorageService: Error clearing passwords', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    // Remove only Keysoft-owned records. AsyncStorage can also be used by
    // third-party libraries, so a global clear risks deleting unrelated state.
    await AsyncStorage.multiRemove(ASYNC_STORAGE_KEYS);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORAGE);

    // Reset cache
    cache.passwords = [];
    cache.categories = [];
    cache.notes = [];
    cache.userPreferences = cloneUserPreferences(defaultUserPreferences);
    cache.masterKeyInfo = null;
    encryptionKey = null;

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
    const newCategory: PasswordCategory = {
      ...category,
      id: generateStorageId(),
    };
    const nextCategories = [...cache.categories, newCategory];
    await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
    cache.categories = nextCategories;
    return newCategory.id;
  } catch (error) {
    Logger.error('StorageService: Error creating category', error);
    throw error;
  }
};

export const updateCategory = async (category: PasswordCategory): Promise<void> => {
  try {
    const index = cache.categories.findIndex((c) => c.id === category.id);
    if (index !== -1) {
      const nextCategories = cache.categories.map((current, currentIndex) =>
        currentIndex === index ? category : current,
      );
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
      cache.categories = nextCategories;
    }
  } catch (error) {
    Logger.error('StorageService: Error updating category', error);
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const nextCategories = cache.categories.filter((category) => category.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(nextCategories));
    cache.categories = nextCategories;
  } catch (error) {
    Logger.error('StorageService: Error deleting category', error);
    throw error;
  }
};

// --- Notes ---

export const saveNote = async (note: Note): Promise<void> => {
  try {
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
    const activeKey = getEncryptionKeyOrThrow('delete note', 'notes');
    const nextNotes = cache.notes.filter((note) => note.id !== noteId);

    const data = JSON.stringify(nextNotes);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encrypted);
    cache.notes = nextNotes;
  } catch (error) {
    Logger.error('StorageService: Error deleting note', error);
    throw error;
  }
};

export const clearAllNotes = async (): Promise<void> => {
  try {
    if (decryptionErrors.notes) {
      throw new Error('Decryption error detected. Cannot clear notes safely.');
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.NOTES);
    cache.notes = [];
    Logger.info('StorageService: All notes cleared');
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
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    cache.userPreferences = cloneUserPreferences(preferences);
    Logger.debug('StorageService: User preferences saved');
  } catch (error) {
    Logger.error('StorageService: Error saving user preferences', error);
    throw error;
  }
};

export const clearPreferences = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    cache.userPreferences = cloneUserPreferences(defaultUserPreferences);
    Logger.info('StorageService: Preferences cleared');
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
