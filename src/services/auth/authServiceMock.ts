import StorageServiceMock from '../storage/storageServiceMock';
import CryptoServiceMock from '../crypto/cryptoServiceMock';
import { UserMasterKey } from '../../models/User';
import Logger from '../../utils/logger';

let isAuthenticated = false;
let masterKeyInfo: UserMasterKey | null = null;
let lastAuthFailure: { reason: string; message: string } | null = null;

const AuthServiceMock = {
  isBiometricsAvailable: async (): Promise<{
    available: boolean;
    biometryType?: 'TouchID' | 'FaceID' | 'Biometrics';
  }> => {
    // Web usually doesn't support biometrics in the same way, return false or mock it
    // For now, let's say it's not available on web for simplicity,
    // or we could mock it if we wanted to test the UI flow.
    return { available: false };
  },

  initDatabase: async (): Promise<void> => {
    return StorageServiceMock.initDatabase();
  },

  setupMasterPassword: async (masterPassword: string): Promise<boolean> => {
    try {
      const { masterKeyInfo: mkInfo, derivedKey: encryptionKey } =
        await CryptoServiceMock.createMasterKeyInfoWithDerivedKey(masterPassword);
      await StorageServiceMock.saveMasterKeyInfo(mkInfo);

      StorageServiceMock.setEncryptionKey(encryptionKey);
      await StorageServiceMock.initDatabase();

      isAuthenticated = true;
      masterKeyInfo = mkInfo;
      return true;
    } catch (error) {
      Logger.error('AuthServiceMock: Error setting up master password', error);
      return false;
    }
  },

  isMasterPasswordConfigured: async (): Promise<boolean> => {
    const info = await StorageServiceMock.getMasterKeyInfo();
    return info !== null;
  },

  loginWithMasterPassword: async (masterPassword: string): Promise<boolean> => {
    try {
      const info = await StorageServiceMock.getMasterKeyInfo();
      if (!info) return false;

      const encryptionKey = await CryptoServiceMock.deriveKey(
        masterPassword,
        info.salt,
        info.iterations,
        info.memory,
      );
      const isValid = CryptoServiceMock.verifyDerivedKey(encryptionKey, info);
      if (isValid) {
        StorageServiceMock.setEncryptionKey(encryptionKey);
        await StorageServiceMock.initDatabase();
        isAuthenticated = true;
        masterKeyInfo = info;
        return true;
      }
      return false;
    } catch (error) {
      Logger.error('AuthServiceMock: Error logging in', error);
      return false;
    }
  },

  loginWithBiometrics: async (): Promise<boolean> => {
    // Mock implementation for web
    lastAuthFailure = {
      reason: 'biometrics_unavailable',
      message: 'Biometrics not supported on web mock',
    };
    Logger.warn('Biometrics not supported on web mock');
    return false;
  },

  logout: async (): Promise<void> => {
    isAuthenticated = false;
    masterKeyInfo = null;
    lastAuthFailure = null;
    StorageServiceMock.setEncryptionKey(''); // clear key
  },

  isAuthenticated: (): boolean => {
    return isAuthenticated;
  },

  getIsAuthenticated: (): boolean => {
    return isAuthenticated;
  },

  getMasterKeyInfo: (): UserMasterKey | null => {
    return masterKeyInfo;
  },

  getLastAuthFailure: (): { reason: string; message: string } | null => {
    return lastAuthFailure;
  },

  authenticateWithMasterPassword: async (masterPassword: string): Promise<boolean> => {
    return AuthServiceMock.loginWithMasterPassword(masterPassword);
  },

  restoreBiometricsState: async (): Promise<boolean> => {
    // Mock implementation
    return false;
  },

  enableBiometrics: async (): Promise<boolean> => {
    // Mock implementation for web - biometrics not supported
    Logger.warn('Biometrics not supported on web mock');
    return false;
  },

  authenticateWithBiometrics: async (): Promise<{ success: boolean; error?: string }> => {
    // Mock implementation for web
    return { success: false, error: 'Biometrics not available on web' };
  },

  updateMasterPassword: async (newPassword: string): Promise<boolean> => {
    try {
      Logger.info('AuthServiceMock: Updating master password...');

      // Create new master key info
      const { masterKeyInfo: newMkInfo, derivedKey: newEncryptionKey } =
        await CryptoServiceMock.createMasterKeyInfoWithDerivedKey(newPassword);

      // Re-encrypt all data with new key (for mock, just update the key)
      await StorageServiceMock.reEncryptAllData(newEncryptionKey);

      // Save new master key info
      await StorageServiceMock.saveMasterKeyInfo(newMkInfo);

      // Update memory state
      masterKeyInfo = newMkInfo;
      StorageServiceMock.setEncryptionKey(newEncryptionKey);

      Logger.info('AuthServiceMock: Master password updated successfully');
      return true;
    } catch (error) {
      Logger.error('AuthServiceMock: Error updating master password', error);
      return false;
    }
  },
};

export default AuthServiceMock;
