import * as AuthService from '../../services/auth/authService';
import * as StorageService from '../../services/storage/storageService';
import * as CryptoService from '../../services/crypto/cryptoService';
import * as LocalAuthentication from 'expo-local-authentication';
import { UserMasterKey } from '../../models/User';

// Mock dependencies
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock('expo-constants', () => ({
  executionEnvironment: 'bare', // Default to prod-like
  default: {
    executionEnvironment: 'bare',
  },
}));

jest.mock('../../services/storage/storageService');
jest.mock('../../services/crypto/cryptoService');
jest.mock('../../utils/logger');

describe('AuthService', () => {
  const mockMasterPassword = 'secure-password';
  const mockEncryptionKey = '000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f';

  const mockMasterKeyInfo: UserMasterKey = {
    salt: 'mock-salt',
    iterations: 1000,
    memory: 65536,
    verifier: 'mock-verifier',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Ensure clean state
    await AuthService.logout();

    // Default mocks
    (CryptoService.createMasterKeyInfo as jest.Mock).mockResolvedValue(mockMasterKeyInfo);
    (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
      masterKeyInfo: mockMasterKeyInfo,
      derivedKey: mockEncryptionKey,
    });
    (CryptoService.deriveKey as jest.Mock).mockResolvedValue(mockEncryptionKey);
    (CryptoService.verifyDerivedKey as jest.Mock).mockReturnValue(true);

    (StorageService.saveMasterKeyInfo as jest.Mock).mockResolvedValue(undefined);
    (StorageService.setEncryptionKey as jest.Mock).mockImplementation(() => {});
    (StorageService.initDatabase as jest.Mock).mockResolvedValue(undefined);
    (StorageService.getMasterKeyInfo as jest.Mock).mockResolvedValue(mockMasterKeyInfo);
    (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(null); // Default: no key
    (StorageService.getBiometricKey as jest.Mock).mockResolvedValue(mockEncryptionKey);
    (StorageService.saveBiometricKey as jest.Mock).mockResolvedValue(undefined);

    // Biometrics default: available and enrolled
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(3); // SecurityLevel.BIOMETRIC (Strong)
  });

  describe('Master Password Setup & Login', () => {
    it('should setup master password correctly', async () => {
      const result = await AuthService.setupMasterPassword(mockMasterPassword);

      expect(result).toBe(true);
      expect(CryptoService.createMasterKeyInfoWithDerivedKey).toHaveBeenCalledWith(
        mockMasterPassword,
      );
      expect(StorageService.saveMasterKeyInfo).toHaveBeenCalledWith(mockMasterKeyInfo);
      expect(StorageService.setEncryptionKey).toHaveBeenCalledWith(mockEncryptionKey);
      expect(StorageService.initDatabase).toHaveBeenCalled();
      expect(AuthService.getIsAuthenticated()).toBe(true);
    });

    it('should login with correct master password', async () => {
      const result = await AuthService.loginWithMasterPassword(mockMasterPassword);

      expect(result).toBe(true);
      expect(StorageService.getMasterKeyInfo).toHaveBeenCalled();
      expect(CryptoService.verifyDerivedKey).toHaveBeenCalledWith(
        mockEncryptionKey,
        mockMasterKeyInfo,
      );
      expect(StorageService.setEncryptionKey).toHaveBeenCalledWith(mockEncryptionKey);
      expect(AuthService.getIsAuthenticated()).toBe(true);
    });

    it('should fail login with incorrect master password', async () => {
      (CryptoService.verifyDerivedKey as jest.Mock).mockReturnValue(false);

      const result = await AuthService.loginWithMasterPassword('wrong-password');

      expect(result).toBe(false);
      expect(AuthService.getIsAuthenticated()).toBe(false); // Should be false if previous tests didn't leak state, or we need to reset it.
      // Note: AuthService has internal state. Ideally we should add a reset method for testing,
      // or rely on logout() in beforeEach.
    });
  });

  describe('Biometrics', () => {
    it('should check biometrics availability', async () => {
      const result = await AuthService.isBiometricsAvailable();

      expect(result.available).toBe(true);
      expect(result.biometryType).toBe('TouchID');
    });

    it('should enable biometrics', async () => {
      // Must be logged in first
      await AuthService.loginWithMasterPassword(mockMasterPassword);

      // Mock successful bio auth during enablement
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({});
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);

      const result = await AuthService.enableBiometrics();

      expect(result).toBe(true);
      expect(StorageService.saveBiometricKey).toHaveBeenCalledWith(mockEncryptionKey);
      expect(StorageService.saveUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          biometricsEnabled: true,
        }),
      );
    });

    it('should login with biometrics using the SecureStore biometric key after cold start', async () => {
      // Setup: Biometrics enabled in prefs
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: true,
      });
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(null);
      (StorageService.getBiometricKey as jest.Mock).mockResolvedValue(mockEncryptionKey);

      const result = await AuthService.loginWithBiometrics();

      expect(result).toBe(true);
      expect(StorageService.getBiometricKey).toHaveBeenCalled();
      expect(StorageService.setEncryptionKey).toHaveBeenCalledWith(mockEncryptionKey);
      expect(StorageService.initDatabase).toHaveBeenCalled();
      expect(AuthService.getIsAuthenticated()).toBe(true);
    });

    it('should fail login with biometrics if disabled in prefs', async () => {
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: false,
      });

      const result = await AuthService.loginWithBiometrics();

      expect(result).toBe(false);
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });

    it('should disable biometrics when the stored biometric key is missing or invalidated', async () => {
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: true,
      });
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(null);
      (StorageService.getBiometricKey as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.loginWithBiometrics();

      expect(result).toBe(false);
      expect(StorageService.saveUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          biometricsEnabled: false,
        }),
      );
      expect(AuthService.getLastAuthFailure()).toEqual(
        expect.objectContaining({
          reason: 'biometric_key_unavailable',
        }),
      );
      expect(AuthService.getIsAuthenticated()).toBe(false);
    });
  });

  describe('Update Master Password', () => {
    it('should reuse the key derived while creating new master key info', async () => {
      const newPassword = 'new-password';
      const newKey = '1112131415161718191a1b1c1d1e1f201112131415161718191a1b1c1d1e1f20';
      const createMasterKeyInfoWithDerivedKey = jest.fn().mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      (
        CryptoService as unknown as {
          createMasterKeyInfoWithDerivedKey: jest.Mock;
        }
      ).createMasterKeyInfoWithDerivedKey = createMasterKeyInfoWithDerivedKey;

      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: false,
      });
      (StorageService.reEncryptAllData as jest.Mock).mockResolvedValue(undefined);
      (StorageService.saveMasterKeyInfo as jest.Mock).mockResolvedValue(undefined);
      (CryptoService.deriveKey as jest.Mock).mockClear();

      const result = await AuthService.updateMasterPassword(newPassword);

      expect(result).toBe(true);
      expect(createMasterKeyInfoWithDerivedKey).toHaveBeenCalledWith(newPassword);
      expect(CryptoService.deriveKey).not.toHaveBeenCalled();
      expect(StorageService.reEncryptAllData).toHaveBeenCalledWith(newKey);
    });

    it('should update master password and re-encrypt data', async () => {
      const newPassword = 'new-password';
      const newKey = 'new-derived-key';

      // Login first
      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);

      // Mock re-encryption
      (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      const result = await AuthService.updateMasterPassword(newPassword);

      expect(result).toBe(true);
      // Verify new key info saved
      expect(CryptoService.createMasterKeyInfoWithDerivedKey).toHaveBeenCalledWith(newPassword);
      expect(StorageService.saveMasterKeyInfo).toHaveBeenCalled();

      // Verify re-encryption called
      expect(StorageService.reEncryptAllData).toHaveBeenCalledWith(newKey);
    });

    it('should update the stored biometric key when biometrics are enabled', async () => {
      const newPassword = 'new-password';
      const newKey = '1112131415161718191a1b1c1d1e1f201112131415161718191a1b1c1d1e1f20';

      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: true,
      });
      (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      const result = await AuthService.updateMasterPassword(newPassword);

      expect(result).toBe(true);
      expect(StorageService.saveBiometricKey).toHaveBeenCalledWith(newKey);
      expect(StorageService.saveUserPreferences).not.toHaveBeenCalledWith(
        expect.objectContaining({
          biometricsEnabled: false,
        }),
      );
    });

    it('should disable biometrics if the biometric key cannot be updated after PIN change', async () => {
      const newPassword = 'new-password';
      const newKey = '1112131415161718191a1b1c1d1e1f201112131415161718191a1b1c1d1e1f20';

      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);
      (StorageService.getUserPreferences as jest.Mock).mockResolvedValue({
        biometricsEnabled: true,
      });
      (StorageService.saveBiometricKey as jest.Mock).mockRejectedValue(
        new Error('SecureStore unavailable'),
      );
      (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      const result = await AuthService.updateMasterPassword(newPassword);

      expect(result).toBe(true);
      expect(StorageService.deleteBiometricKey).toHaveBeenCalled();
      expect(StorageService.saveUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          biometricsEnabled: false,
        }),
      );
    });

    it('should rollback re-encryption when saveMasterKeyInfo fails', async () => {
      const newPassword = 'new-password';
      const newKey = 'new-derived-key';

      // Login first to populate currentKey
      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);
      (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      // reEncryptAllData succeeds (data now encrypted with newKey)
      const reEncryptCalls: string[] = [];
      (StorageService.reEncryptAllData as jest.Mock).mockImplementation(async (key: string) => {
        reEncryptCalls.push(key);
      });
      // saveMasterKeyInfo fails — simulating SecureStore being unavailable
      (StorageService.saveMasterKeyInfo as jest.Mock).mockRejectedValueOnce(
        new Error('SecureStore unavailable'),
      );

      const result = await AuthService.updateMasterPassword(newPassword);

      // Update must fail
      expect(result).toBe(false);

      // Rollback: reEncryptAllData should be called twice — once with newKey, once with currentKey (rollback)
      expect(reEncryptCalls).toEqual([newKey, mockEncryptionKey]);

      // In-memory key restored to old key
      expect(StorageService.setEncryptionKey).toHaveBeenLastCalledWith(mockEncryptionKey);
    });

    it('should force logout when both forward re-encryption and rollback fail', async () => {
      const newPassword = 'new-password';
      const newKey = 'new-derived-key';

      await AuthService.loginWithMasterPassword(mockMasterPassword);
      (StorageService.getEncryptionKey as jest.Mock).mockReturnValue(mockEncryptionKey);
      (CryptoService.createMasterKeyInfoWithDerivedKey as jest.Mock).mockResolvedValue({
        masterKeyInfo: mockMasterKeyInfo,
        derivedKey: newKey,
      });

      // First reEncryptAllData succeeds, second (rollback) fails
      let callCount = 0;
      (StorageService.reEncryptAllData as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return; // first call succeeds
        throw new Error('Rollback partial failure');
      });
      (StorageService.saveMasterKeyInfo as jest.Mock).mockRejectedValueOnce(
        new Error('SecureStore unavailable'),
      );

      const result = await AuthService.updateMasterPassword(newPassword);

      expect(result).toBe(false);
      // After rollback failure, isAuthenticated must be false
      expect(AuthService.getIsAuthenticated()).toBe(false);
      // Encryption key must be cleared
      expect(StorageService.setEncryptionKey).toHaveBeenLastCalledWith('');
    });
  });

  describe('verifyMasterPassword', () => {
    it('should return true for correct password without modifying auth state', async () => {
      // beforeEach -> logout calls setEncryptionKey(''). Reset mocks so
      // testare le call effettive di verifyMasterPassword.
      jest.clearAllMocks();
      // Re-mock dopo clearAllMocks
      (StorageService.getMasterKeyInfo as jest.Mock).mockResolvedValue(mockMasterKeyInfo);
      (CryptoService.deriveKey as jest.Mock).mockResolvedValue(mockEncryptionKey);
      (CryptoService.verifyDerivedKey as jest.Mock).mockReturnValue(true);

      expect(AuthService.getIsAuthenticated()).toBe(false);

      const result = await AuthService.verifyMasterPassword(mockMasterPassword);

      expect(result).toBe(true);
      // Crucially: verifyMasterPassword must NOT set isAuthenticated, nor call initDatabase
      expect(AuthService.getIsAuthenticated()).toBe(false);
      expect(StorageService.initDatabase).not.toHaveBeenCalled();
      expect(StorageService.setEncryptionKey).not.toHaveBeenCalled();
    });

    it('should return false for incorrect password without modifying auth state', async () => {
      (CryptoService.verifyDerivedKey as jest.Mock).mockReturnValue(false);

      const result = await AuthService.verifyMasterPassword('wrong-password');

      expect(result).toBe(false);
      expect(AuthService.getIsAuthenticated()).toBe(false);
    });

    it('should expose native KDF unavailable instead of reporting a bad PIN', async () => {
      (CryptoService.deriveKey as jest.Mock).mockRejectedValue({
        name: 'KdfError',
        code: 'ARGON2_UNAVAILABLE',
        message: 'Native KDF unavailable',
      });

      const result = await AuthService.loginWithMasterPassword(mockMasterPassword);

      expect(result).toBe(false);
      expect(CryptoService.verifyDerivedKey).not.toHaveBeenCalled();
      expect(AuthService.getLastAuthFailure()).toEqual(
        expect.objectContaining({
          reason: 'native_kdf_unavailable',
        }),
      );
    });
  });
});
