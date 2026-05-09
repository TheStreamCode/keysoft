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
  userPreferences: { ...defaultUserPreferences },
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

  // 1. Encrypt Passwords with new key
  try {
    const passwordsData = JSON.stringify(cache.passwords);
    const encryptedPasswords = await CryptoService.encrypt(passwordsData, newKey);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encryptedPasswords);
    Logger.debug('StorageService: Passwords re-encrypted successfully');
  } catch (error) {
    Logger.error('StorageService: Error re-encrypting passwords', error);
    throw new Error('Failed to re-encrypt passwords');
  }

  // 2. Encrypt Notes with new key
  try {
    const notesData = JSON.stringify(cache.notes);
    const encryptedNotes = await CryptoService.encrypt(notesData, newKey);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encryptedNotes);
    Logger.debug('StorageService: Notes re-encrypted successfully');
  } catch (error) {
    Logger.error('StorageService: Error re-encrypting notes', error);
    throw new Error('Failed to re-encrypt notes');
  }

  // 3. Update memory key
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

    // Load Master Key Info
    const masterKeyInfoJson = await SecureStore.getItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
    if (masterKeyInfoJson) {
      cache.masterKeyInfo = JSON.parse(masterKeyInfoJson);
      Logger.debug('StorageService: Master key info loaded');
    }

    // Load User Preferences
    const userPreferencesJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (userPreferencesJson) {
      const storedPrefs = JSON.parse(userPreferencesJson);
      cache.userPreferences = { ...defaultUserPreferences, ...storedPrefs };
      if (!cache.userPreferences.language) {
        cache.userPreferences.language = 'it';
      }
      Logger.debug('StorageService: User preferences loaded');
    }

    // Load Passwords
    const passwordsJson = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORDS);
    if (passwordsJson) {
      if (encryptionKey && !passwordsJson.trim().startsWith('[')) {
        try {
          // Decrypt if key is set and data doesn't look like a JSON array
          // Note: We await CryptoService.decrypt in case it becomes async or is mocked as async
          const decrypted = await CryptoService.decrypt(passwordsJson, encryptionKey);
          cache.passwords = JSON.parse(decrypted);
          Logger.debug(`StorageService: Loaded ${cache.passwords.length} passwords (decrypted)`);
        } catch (e) {
          Logger.error('StorageService: Error decrypting passwords', e);
          decryptionErrors.passwords = true;
          cache.passwords = [];
        }
      } else if (passwordsJson.trim().startsWith('[')) {
        // Plain text (legacy or dev)
        cache.passwords = JSON.parse(passwordsJson);
        Logger.debug(`StorageService: Loaded ${cache.passwords.length} passwords (plain)`);
        if (encryptionKey) {
          const encryptedPasswords = await CryptoService.encrypt(
            JSON.stringify(cache.passwords),
            encryptionKey,
          );
          await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encryptedPasswords);
          Logger.info('StorageService: Legacy plaintext passwords migrated to encrypted storage');
        }
      } else {
        // Encrypted but no key
        Logger.debug('StorageService: Passwords are encrypted and no key set. Skipping load.');
      }
    }

    // Load Categories
    const categoriesJson = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (categoriesJson) {
      cache.categories = JSON.parse(categoriesJson);
    }

    // Load Notes
    const notesJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
    if (notesJson) {
      if (encryptionKey && !notesJson.trim().startsWith('[')) {
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
        if (encryptionKey) {
          const encryptedNotes = await CryptoService.encrypt(
            JSON.stringify(cache.notes),
            encryptionKey,
          );
          await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encryptedNotes);
          Logger.info('StorageService: Legacy plaintext notes migrated to encrypted storage');
        }
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
    const existingIndex = password.id ? cache.passwords.findIndex((p) => p.id === password.id) : -1;

    if (existingIndex !== -1) {
      cache.passwords[existingIndex] = {
        ...password,
        updatedAt: Date.now(),
      };
    } else {
      checkPasswordLimit();
      const newPassword: Password = {
        ...password,
        id: password.id || generateStorageId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      cache.passwords.push(newPassword);
      password.id = newPassword.id; // ensure return ID is correct
    }

    const activeKey = getEncryptionKeyOrThrow('save password', 'passwords');

    const data = JSON.stringify(cache.passwords);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encrypted);

    return password.id;
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
  return migrateCategories([...cache.passwords]);
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
  const migrated = migrateCategories(sliced);

  return { passwords: migrated, total };
};

export const deletePassword = async (id: string): Promise<void> => {
  try {
    cache.passwords = cache.passwords.filter((p) => p.id !== id);

    const activeKey = getEncryptionKeyOrThrow('delete password', 'passwords');

    const data = JSON.stringify(cache.passwords);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, encrypted);
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
    cache.passwords = [];
    await AsyncStorage.removeItem(STORAGE_KEYS.PASSWORDS);
    Logger.info('StorageService: All passwords cleared');
  } catch (error) {
    Logger.error('StorageService: Error clearing passwords', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync(STORAGE_KEYS.MASTER_KEY_INFO_SECURE);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORAGE);

    // Reset cache
    cache.passwords = [];
    cache.categories = [];
    cache.notes = [];
    cache.userPreferences = { ...defaultUserPreferences };
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
    cache.categories.push(newCategory);
    await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cache.categories));
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
      cache.categories[index] = category;
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cache.categories));
    }
  } catch (error) {
    Logger.error('StorageService: Error updating category', error);
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  try {
    cache.categories = cache.categories.filter((c) => c.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cache.categories));
  } catch (error) {
    Logger.error('StorageService: Error deleting category', error);
    throw error;
  }
};

// --- Notes ---

export const saveNote = async (note: Note): Promise<void> => {
  try {
    const existingIndex = cache.notes.findIndex((n) => n.id === note.id);
    if (existingIndex >= 0) {
      cache.notes[existingIndex] = note;
    } else {
      cache.notes.push(note);
    }

    const activeKey = getEncryptionKeyOrThrow('save note', 'notes');

    const data = JSON.stringify(cache.notes);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encrypted);
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
    cache.notes = cache.notes.filter((n) => n.id !== noteId);

    const activeKey = getEncryptionKeyOrThrow('delete note', 'notes');

    const data = JSON.stringify(cache.notes);
    const encrypted = await CryptoService.encrypt(data, activeKey);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, encrypted);
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
    cache.notes = [];
    await AsyncStorage.removeItem(STORAGE_KEYS.NOTES);
    Logger.info('StorageService: All notes cleared');
  } catch (error) {
    Logger.error('StorageService: Error clearing notes', error);
    throw error;
  }
};

// --- User Preferences ---

export const getUserPreferences = async (): Promise<UserPreferences> => {
  return { ...cache.userPreferences };
};

export const saveUserPreferences = async (preferences: UserPreferences): Promise<void> => {
  try {
    cache.userPreferences = { ...preferences };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    Logger.debug('StorageService: User preferences saved');
  } catch (error) {
    Logger.error('StorageService: Error saving user preferences', error);
    throw error;
  }
};

export const clearPreferences = async (): Promise<void> => {
  try {
    cache.userPreferences = { ...defaultUserPreferences };
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    Logger.info('StorageService: Preferences cleared');
  } catch (error) {
    Logger.error('StorageService: Error clearing preferences', error);
    throw error;
  }
};

// --- Helpers ---

const migrateCategories = (passwords: Password[]): Password[] => {
  const categoryMapping: Record<string, string> = {
    login: 'email',
    browse: 'shopping',
    card: 'gaming',
  };

  return passwords.map((password) => {
    const mappedCategory = password.category ? categoryMapping[password.category] : undefined;
    if (!mappedCategory) {
      return password;
    }

    const updatedPassword: Password = {
      ...password,
      category: mappedCategory,
    };

    // Background save
    savePassword(updatedPassword).catch((error) =>
      Logger.warn('StorageService: Error migrating category', error),
    );

    return updatedPassword;
  });
};
