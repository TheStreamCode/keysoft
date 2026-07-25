// Web-specific services index: use mock services only to avoid native modules.
//
// SECURITY — DEVELOPMENT TARGET ONLY. These mocks do not encrypt anything. On web
// `AsyncStorage` is `localStorage`, and `storageServiceMock.savePassword` writes
// `JSON.stringify(passwords)` verbatim, so the vault sits in cleartext. Worse, the
// mock reports encryption as active: `isEncryptionKeySet()` returns true once a key
// is set even though the key is never used, and `reEncryptAllData` logs
// "re-encryption complete" after merely reassigning a variable.
//
// A production web build would therefore ship a password manager that claims to be
// encrypted and is not. The guard below makes that build fail instead of shipping
// silently. Remove it only once the web target uses real WebCrypto-backed services.
import CryptoServiceMock from './crypto/cryptoServiceMock';
import StorageServiceMock, {
  MAX_PASSWORDS_LIMIT as MOCK_LIMIT,
} from './storage/storageServiceMock';
import AuthServiceMock from './auth/authServiceMock';
import Logger from '../utils/logger';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'keysoft: the web target uses unencrypted mock services and must not be built for ' +
      'production. It stores the vault in cleartext in localStorage while reporting ' +
      'encryption as enabled. Use the iOS or Android build, or implement real WebCrypto ' +
      'services before removing this guard.',
  );
}

Logger.warn(
  'keysoft (web): running on unencrypted mock services — the vault is stored in cleartext. ' +
    'Development use only.',
);

export const Crypto = CryptoServiceMock;
export const Storage = StorageServiceMock;
export const Auth = AuthServiceMock as any;
export const MAX_PASSWORDS_LIMIT = MOCK_LIMIT;

// Ensure restoreBiometricsState exists
if (!(Auth as any).restoreBiometricsState) {
  Logger.warn(
    'ATTENZIONE (web): Metodo restoreBiometricsState non disponibile in Auth. Aggiunta implementazione di fallback.',
  );
  (Auth as any).restoreBiometricsState = async function () {
    try {
      const { available } = await (Auth as any).isBiometricsAvailable();
      if (!available) return false;
      const preferences = await Storage.getUserPreferences();
      const biometricsEnabled = preferences?.biometricsEnabled === true;
      if (!biometricsEnabled) return false;
      const masterKeyInfo = await Storage.getMasterKeyInfo();
      if (!masterKeyInfo) return false;
      return true;
    } catch (error) {
      Logger.error('Errore durante il ripristino dello stato della biometria (web):', error);
      return false;
    }
  };
}

export interface IStorageService {
  initDatabase(): Promise<void>;
  saveMasterKeyInfo(masterKeyInfo: any): Promise<void>;
  getMasterKeyInfo(): Promise<any | null>;
  setEncryptionKey(key: string): void;
  isEncryptionKeySet(): boolean;
  savePassword(password: any): Promise<string>;
  getPassword(id: string): Promise<any | null>;
  getAllPasswords(): Promise<any[]>;
  getPasswordsPaginated(
    limit?: number,
    offset?: number,
    category?: string,
    searchQuery?: string,
  ): Promise<{ passwords: any[]; total: number }>;
  deletePassword(id: string): Promise<void>;
  getUserPreferences(): Promise<any>;
  saveUserPreferences(preferences: any): Promise<void>;
  getPasswordCount(): Promise<number>;
  canAddPassword(): Promise<boolean>;
}
