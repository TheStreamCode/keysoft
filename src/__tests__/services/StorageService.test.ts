import * as StorageService from '../../services/storage/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Password } from '../../models/Password';
import { Note } from '../../models/Note';
import * as CryptoService from '../../services/crypto/cryptoService';

// Mock SecureStore with constants
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'mock-constant-value',
  WHEN_UNLOCKED: 'mock-when-unlocked',
}));

// Mock dependencies
// Mock cryptoService with explicit implementation to avoid read-only property errors
jest.mock('../../services/crypto/cryptoService', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  generateSalt: jest.fn(),
  deriveKey: jest.fn(),
  createMasterKeyInfo: jest.fn(),
  verifyMasterPassword: jest.fn(),
}));

describe('StorageService', () => {
  const mockEncryptionKey = '000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f';
  const mockTimestamp = 1625097600000; // Fixed timestamp

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) =>
      Promise.all(
        keys.map(async (key) => [key, await (AsyncStorage.getItem as jest.Mock)(key)] as const),
      ),
    );
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    await StorageService.clearAllData();
    jest.clearAllMocks();

    // Set encryption key for tests
    StorageService.setEncryptionKey(mockEncryptionKey);

    // Mock CryptoService behavior
    (CryptoService.encrypt as jest.Mock).mockImplementation((data, _key) =>
      Promise.resolve(`encrypted-${data}`),
    );
    (CryptoService.decrypt as jest.Mock).mockImplementation((data, _key) =>
      Promise.resolve(data.replace('encrypted-', '')),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Encryption Key', () => {
    it('should treat empty encryption key as unset', () => {
      StorageService.setEncryptionKey('');

      expect(StorageService.getEncryptionKey()).toBeNull();
      expect(StorageService.isEncryptionKeySet()).toBe(false);
    });

    it('should report encryption key set when non-empty', () => {
      StorageService.setEncryptionKey('test-key');

      expect(StorageService.getEncryptionKey()).toBe('test-key');
      expect(StorageService.isEncryptionKeySet()).toBe(true);
    });
  });

  describe('User Preferences', () => {
    it('should save and load user preferences', async () => {
      const prefs = { username: 'Test User', theme: 'dark' };

      await StorageService.saveUserPreferences(prefs as any);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('user_preferences'),
        JSON.stringify(prefs),
      );
    });
  });

  describe('Passwords', () => {
    const mockPassword: Password = {
      id: '1',
      title: 'Test Site',
      username: 'user',
      password: 'secret-password',
      website: 'example.com',
      category: 'social',
      createdAt: 1625097600000,
      updatedAt: 1625097600000,
    };

    it('should save a password encrypted', async () => {
      // Mock existing passwords
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await StorageService.savePassword(mockPassword);

      expect(CryptoService.encrypt).toHaveBeenCalledWith(
        JSON.stringify([mockPassword]),
        mockEncryptionKey,
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('passwords'),
        expect.stringContaining('encrypted-'),
      );
    });

    it('should retrieve decrypted passwords', async () => {
      // Mock stored encrypted data
      const storedData = `encrypted-${JSON.stringify([mockPassword])}`;
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key && key.includes('passwords')) return Promise.resolve(storedData);
        return Promise.resolve(null);
      });

      // Force reload from storage to populate cache with decrypted data
      await StorageService.initDatabase();

      const passwords = await StorageService.getAllPasswords();

      expect(CryptoService.decrypt).toHaveBeenCalledWith(storedData, mockEncryptionKey);
      expect(passwords).toHaveLength(1);
      expect(passwords[0].id).toBe(mockPassword.id);
    });

    it('should immediately encrypt legacy plaintext passwords and notes when an encryption key is set', async () => {
      const legacyPasswords = [mockPassword];
      const legacyNotes: Note[] = [
        {
          id: 'note-1',
          title: 'Legacy Note',
          content: 'Plain secret',
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          color: '#ffffff',
          isPinned: false,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('passwords')) return Promise.resolve(JSON.stringify(legacyPasswords));
        if (key.includes('notes')) return Promise.resolve(JSON.stringify(legacyNotes));
        return Promise.resolve(null);
      });

      await StorageService.initDatabase();

      expect(CryptoService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(legacyPasswords),
        mockEncryptionKey,
      );
      expect(CryptoService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(legacyNotes),
        mockEncryptionKey,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('passwords'),
        `encrypted-${JSON.stringify(legacyPasswords)}`,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('notes'),
        `encrypted-${JSON.stringify(legacyNotes)}`,
      );
    });
  });

  describe('Biometric Keys', () => {
    it('should save the biometric key behind device authentication', async () => {
      await StorageService.saveBiometricKey(mockEncryptionKey);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'keysoft_biometric_key',
        mockEncryptionKey,
        expect.objectContaining({
          requireAuthentication: true,
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
          authenticationPrompt: expect.any(String),
        }),
      );
    });

    it('should reject biometric keys that are not 64-character hex strings', async () => {
      await expect(StorageService.saveBiometricKey('not-a-derived-key')).rejects.toThrow(
        'Invalid biometric key format',
      );
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should read the biometric key behind device authentication', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockEncryptionKey);

      const result = await StorageService.getBiometricKey();

      expect(result).toBe(mockEncryptionKey);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        'keysoft_biometric_key',
        expect.objectContaining({
          requireAuthentication: true,
          authenticationPrompt: expect.any(String),
        }),
      );
    });

    it('should delete any legacy biometric key', async () => {
      await StorageService.deleteBiometricKey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('keysoft_biometric_key');
    });
  });

  describe('Re-Encryption', () => {
    it('should re-encrypt all data with new key', async () => {
      const newKey = 'new-encryption-key';

      // Mock existing data
      const mockPassword: Password = {
        id: '1',
        title: 'Test',
        username: 'user',
        password: 'pw',
        website: 'web',
        category: 'cat',
        createdAt: 0,
        updatedAt: 0,
      };

      // Setup mock returns for encrypt
      (CryptoService.encrypt as jest.Mock).mockImplementation((data, key) => {
        if (key === newKey) return Promise.resolve(`new-encrypted-${data}`);
        return Promise.resolve(`encrypted-${data}`);
      });

      // Pre-load cache with decrypted data (as if user is logged in)
      // We need to bypass the private cache mechanism by mocking getAllPasswords/Notes or assuming they use the cache variable we can't access directly.
      // Since we can't access the private 'cache' variable, we rely on the fact that initDatabase populates it.
      // But initDatabase calls decrypt.

      // Let's simulate that initDatabase has run and populated the cache
      // We do this by spying on internal logic if possible, or by trusting the public API.
      // Ideally, we'd add data via savePassword first.
      await StorageService.savePassword(mockPassword);

      // Clear previous calls to focus on re-encryption
      jest.clearAllMocks();

      await StorageService.reEncryptAllData(newKey);

      // Verify passwords re-encrypted with new key
      expect(CryptoService.encrypt).toHaveBeenCalledWith(
        expect.any(String), // The stringified passwords
        newKey,
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('passwords'),
        expect.stringContaining('new-encrypted-'),
      );

      // Verify internal key update by checking if a new password save uses the new key
      const newPassword: Password = {
        id: '2',
        title: 'New Pass',
        username: 'user',
        password: 'pw',
        website: 'web',
        category: 'cat',
        createdAt: 0,
        updatedAt: 0,
      };

      jest.clearAllMocks();
      await StorageService.savePassword(newPassword);

      expect(CryptoService.encrypt).toHaveBeenCalledWith(expect.any(String), newKey);
    });
  });

  describe('Notes', () => {
    const mockNote: Note = {
      id: '1',
      title: 'Test Note',
      content: 'Secret content',
      createdAt: 1625097600000,
      updatedAt: 1625097600000,
      color: '#ffffff',
      isPinned: false,
    };

    it('should save a note encrypted', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await StorageService.saveNote(mockNote);

      expect(CryptoService.encrypt).toHaveBeenCalledWith(
        JSON.stringify([mockNote]),
        mockEncryptionKey,
      );
    });
  });
});
