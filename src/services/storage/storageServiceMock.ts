import AsyncStorage from '@react-native-async-storage/async-storage';
import { Password } from '../../models/Password';
import { UserPreferences, UserMasterKey } from '../../models/User';
import { Note } from '../../models/Note';
import Logger from '../../utils/logger';

// Constants
const STORAGE_KEYS = {
  USER_PREFERENCES: 'keysoft_mock_user_preferences',
  PASSWORDS: 'keysoft_mock_passwords',
  CATEGORIES: 'keysoft_mock_categories',
  NOTES: 'keysoft_mock_notes',
  MASTER_KEY_INFO: 'keysoft_mock_master_key_info',
  BIOMETRIC_KEY: 'keysoft_mock_biometric_key',
};

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
    password_expiry: true,
    weak_password: true,
    duplicate_password: true,
    auto_lock_warning: true,
    clipboard_clear_warning: true,
    login_success: false,
    login_failure: true,
    backup_reminder: true,
    backup_success: true,
  },
  username: 'Utente Web',
  hasPromptedForBiometrics: false,
};

// State
let encryptionKey: string | null = null;
let cachedMasterKeyInfo: UserMasterKey | null = null;

function assertBiometricKeyFormat(key: string): void {
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('Invalid biometric key format');
  }
}

const StorageServiceMock = {
  initDatabase: async (): Promise<void> => {
    Logger.debug('StorageServiceMock: Initializing database...');
    return Promise.resolve();
  },

  saveMasterKeyInfo: async (masterKeyInfo: UserMasterKey): Promise<void> => {
    try {
      cachedMasterKeyInfo = masterKeyInfo;
      await AsyncStorage.setItem(STORAGE_KEYS.MASTER_KEY_INFO, JSON.stringify(masterKeyInfo));
    } catch (error) {
      Logger.error('StorageServiceMock: Error saving master key info', error);
    }
  },

  getMasterKeyInfo: async (): Promise<UserMasterKey | null> => {
    try {
      if (cachedMasterKeyInfo) return cachedMasterKeyInfo;
      const json = await AsyncStorage.getItem(STORAGE_KEYS.MASTER_KEY_INFO);
      if (json) {
        cachedMasterKeyInfo = JSON.parse(json);
        return cachedMasterKeyInfo;
      }
      return null;
    } catch (error) {
      Logger.error('StorageServiceMock: Error getting master key info', error);
      return null;
    }
  },

  deleteMasterKeyInfo: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.MASTER_KEY_INFO);
    cachedMasterKeyInfo = null;
  },

  setEncryptionKey: (key: string): void => {
    if (!key) {
      encryptionKey = null;
      return;
    }

    encryptionKey = key;
  },

  isEncryptionKeySet: (): boolean => {
    return !!encryptionKey;
  },

  savePassword: async (password: Password): Promise<string> => {
    const passwords = await StorageServiceMock.getAllPasswords();
    const index = passwords.findIndex((p) => p.id === password.id);

    if (index >= 0) {
      passwords[index] = password;
    } else {
      passwords.push(password);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(passwords));
    return password.id;
  },

  getPassword: async (id: string): Promise<Password | null> => {
    const passwords = await StorageServiceMock.getAllPasswords();
    return passwords.find((p) => p.id === id) || null;
  },

  getAllPasswords: async (): Promise<Password[]> => {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORDS);
    return json ? JSON.parse(json) : [];
  },

  getPasswordsPaginated: async (
    limit: number = 20,
    offset: number = 0,
    category?: string,
    searchQuery?: string,
  ): Promise<{ passwords: Password[]; total: number }> => {
    let passwords = await StorageServiceMock.getAllPasswords();

    if (category) {
      passwords = passwords.filter((p) => p.category === category);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      passwords = passwords.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.username && p.username.toLowerCase().includes(query)),
      );
    }

    const total = passwords.length;
    const sliced = passwords.slice(offset, offset + limit);

    return { passwords: sliced, total };
  },

  deletePassword: async (id: string): Promise<void> => {
    const passwords = await StorageServiceMock.getAllPasswords();
    const newPasswords = passwords.filter((p) => p.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(newPasswords));
  },

  getUserPreferences: async (): Promise<UserPreferences> => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (json) return JSON.parse(json);
      return defaultUserPreferences;
    } catch (error) {
      Logger.error('StorageServiceMock: Error getting user preferences', error);
      return defaultUserPreferences;
    }
  },

  saveUserPreferences: async (preferences: UserPreferences): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      Logger.error('StorageServiceMock: Error saving user preferences', error);
    }
  },

  getPasswordCount: async (): Promise<number> => {
    const passwords = await StorageServiceMock.getAllPasswords();
    return passwords.length;
  },

  canAddPassword: async (): Promise<boolean> => {
    const count = await StorageServiceMock.getPasswordCount();
    return count < MAX_PASSWORDS_LIMIT;
  },

  importBackupData: async (imported: {
    passwords?: Password[];
    notes?: Note[];
  }): Promise<{ passwords: number; notes: number }> => {
    const passwords = await StorageServiceMock.getAllPasswords();
    const notes = await StorageServiceMock.getNotes();

    const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
      const merged = [...current];
      const indexesById = new Map(merged.map((record, index) => [record.id, index]));
      for (const record of incoming) {
        const existingIndex = indexesById.get(record.id);
        if (existingIndex === undefined) {
          indexesById.set(record.id, merged.length);
          merged.push(record);
        } else {
          merged[existingIndex] = record;
        }
      }
      return merged;
    };

    const nextPasswords = mergeById(passwords, imported.passwords ?? []);
    if (nextPasswords.length > MAX_PASSWORDS_LIMIT) {
      throw new Error(`Password limit of ${MAX_PASSWORDS_LIMIT} would be exceeded.`);
    }

    const writes: [string, string][] = [];
    if (imported.passwords) {
      writes.push([STORAGE_KEYS.PASSWORDS, JSON.stringify(nextPasswords)]);
    }
    if (imported.notes) {
      writes.push([STORAGE_KEYS.NOTES, JSON.stringify(mergeById(notes, imported.notes))]);
    }
    if (writes.length > 0) await AsyncStorage.multiSet(writes);

    return {
      passwords: imported.passwords?.length ?? 0,
      notes: imported.notes?.length ?? 0,
    };
  },

  // Notes methods
  getNotes: async (): Promise<Note[]> => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      Logger.error('StorageServiceMock: Error getting notes', error);
      return [];
    }
  },

  getNoteById: async (id: string): Promise<Note | null> => {
    const notes = await StorageServiceMock.getNotes();
    return notes.find((n) => n.id === id) || null;
  },

  saveNote: async (note: Note): Promise<string> => {
    const notes = await StorageServiceMock.getNotes();
    const index = notes.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.push(note);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    return note.id;
  },

  deleteNote: async (id: string): Promise<void> => {
    const notes = await StorageServiceMock.getNotes();
    const newNotes = notes.filter((n) => n.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
  },

  getEncryptionKey: (): string | null => {
    return encryptionKey;
  },

  saveBiometricKey: async (key: string): Promise<void> => {
    assertBiometricKeyFormat(key);
    await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_KEY, key);
  },

  getBiometricKey: async (): Promise<string | null> => {
    return AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_KEY);
  },

  deleteBiometricKey: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_KEY);
  },

  reEncryptAllData: async (newKey: string): Promise<void> => {
    // SECURITY: this re-encrypts nothing. It reassigns the key variable and logs
    // "complete", so a caller cannot distinguish it from a real rotation. Nothing
    // in this mock ever encrypts: `savePassword` writes JSON verbatim. See the
    // production guard in `src/services/index.web.ts`.
    // For mock, we just update the encryption key
    // In a real implementation, this would re-encrypt all stored data
    Logger.debug('StorageServiceMock: Re-encrypting data with new key...');
    encryptionKey = newKey;
    Logger.debug('StorageServiceMock: Data re-encryption complete');
  },

  clearAllData: async (): Promise<void> => {
    try {
      Logger.debug('StorageServiceMock: Clearing all data...');
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      encryptionKey = null;
      cachedMasterKeyInfo = null;
      Logger.debug('StorageServiceMock: All data cleared successfully');
    } catch (error) {
      Logger.error('StorageServiceMock: Error clearing all data', error);
      throw error;
    }
  },
};

export default StorageServiceMock;
