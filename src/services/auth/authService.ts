import * as LocalAuthentication from 'expo-local-authentication';
import * as CryptoService from '../crypto/cryptoService';
import * as StorageService from '../storage/storageService';
import { UserMasterKey } from '../../models/User';
import Constants from 'expo-constants';
import Logger from '../../utils/logger';

// State
let isAuthenticated = false;
let masterKeyInfo: UserMasterKey | null = null;
let lastAuthFailure: AuthFailure | null = null;

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export type TBiometryTypes = 'TouchID' | 'FaceID' | 'Biometrics';
export type AuthFailureReason =
  | 'master_key_info_missing'
  | 'native_kdf_unavailable'
  | 'kdf_timeout'
  | 'derive_key_failed'
  | 'verifier_mismatch'
  | 'init_database_failed'
  | 'biometrics_unavailable'
  | 'biometrics_disabled'
  | 'biometric_key_unavailable'
  | 'biometric_auth_failed'
  | 'not_authenticated';

export interface AuthFailure {
  reason: AuthFailureReason;
  message: string;
}

interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

function setAuthFailure(reason: AuthFailureReason, message: string): void {
  lastAuthFailure = { reason, message };
  Logger.warn(`AuthService: ${message}`);
}

function clearAuthFailure(): void {
  lastAuthFailure = null;
}

function getKdfFailureReason(error: unknown): AuthFailureReason {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code === 'ARGON2_UNAVAILABLE') {
    return 'native_kdf_unavailable';
  }

  if (code === 'ARGON2_TIMEOUT') {
    return 'kdf_timeout';
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('timed out')) {
    return 'kdf_timeout';
  }

  return 'derive_key_failed';
}

async function deriveMasterKey(
  masterPassword: string,
  mkInfo: UserMasterKey,
): Promise<string | null> {
  try {
    return await CryptoService.deriveKey(
      masterPassword,
      mkInfo.salt,
      mkInfo.iterations,
      mkInfo.memory,
    );
  } catch (error) {
    const reason = getKdfFailureReason(error);
    setAuthFailure(
      reason,
      reason === 'native_kdf_unavailable'
        ? 'Native Argon2 KDF unavailable for this vault'
        : 'Master key derivation failed',
    );
    return null;
  }
}

async function disableBiometrics(
  prefs?: Awaited<ReturnType<typeof StorageService.getUserPreferences>>,
): Promise<void> {
  const currentPrefs = prefs ?? (await StorageService.getUserPreferences());
  await StorageService.deleteBiometricKey();
  await StorageService.saveUserPreferences({
    ...currentPrefs,
    biometricsEnabled: false,
  });
}

/**
 * Best-effort, non-destructive upgrade of a legacy vault (PBKDF2 or the old heavy
 * Argon2 parameters) to the current Argon2id parameters. Runs after a successful
 * password login while the vault is decrypted in memory. On any failure the vault is
 * left on its previous (working) key, so the user is never locked out and the upgrade
 * simply retries on the next login.
 */
async function upgradeVaultKdfIfLegacy(
  masterPassword: string,
  mkInfo: UserMasterKey,
): Promise<void> {
  if (!CryptoService.isNativeKdfAvailable()) return; // Expo Go: cannot derive Argon2
  if (!CryptoService.isLegacyKdf(mkInfo)) return;

  const currentKey = StorageService.getEncryptionKey();
  if (!currentKey) return;

  try {
    Logger.info('AuthService: upgrading vault KDF to current Argon2id parameters');

    const { masterKeyInfo: newMkInfo, derivedKey: newKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(masterPassword);

    // Re-encrypt the in-memory vault with the new key, then persist the new metadata.
    await StorageService.reEncryptAllData(newKey);
    try {
      await StorageService.saveMasterKeyInfo(newMkInfo);
    } catch (error) {
      // Roll back to the previous key so storage and metadata stay consistent.
      await StorageService.reEncryptAllData(currentKey);
      StorageService.setEncryptionKey(currentKey);
      throw error;
    }

    // Keep biometric unlock working by storing the new vault key.
    const prefs = await StorageService.getUserPreferences();
    if (prefs.biometricsEnabled) {
      try {
        await StorageService.saveBiometricKey(newKey);
      } catch (biometricError) {
        Logger.warn(
          'AuthService: failed to refresh biometric key after KDF upgrade',
          biometricError,
        );
        await disableBiometrics(prefs);
      }
    }

    masterKeyInfo = newMkInfo;
    StorageService.setEncryptionKey(newKey);
    Logger.info('AuthService: vault KDF upgrade completed');
  } catch (error) {
    Logger.warn('AuthService: vault KDF upgrade skipped (will retry next login)', error);
  }
}

function getBiometryType(types: number[]): TBiometryTypes {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'FaceID';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'TouchID';
  }

  return 'Biometrics';
}

async function promptBiometricAuthentication(promptMessage: string): Promise<boolean> {
  const { success } = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Annulla',
    fallbackLabel: 'PIN',
  });
  return success;
}

/**
 * Checks if biometric authentication is available.
 */
export const isBiometricsAvailable = async (): Promise<{
  available: boolean;
  biometryType?: TBiometryTypes;
  securityLevel?: number;
}> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

    if (!hasHardware || !isEnrolled) {
      return { available: false, securityLevel };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const biometryType = getBiometryType(types);

    return { available: true, biometryType, securityLevel };
  } catch (error) {
    Logger.error('AuthService: Error checking biometrics availability', error);
    return { available: false };
  }
};

/**
 * Initializes the database via StorageService.
 */
export const initDatabase = async (): Promise<void> => {
  await StorageService.initDatabase();
};

/**
 * Configures the master password for the user.
 */
export const setupMasterPassword = async (masterPassword: string): Promise<boolean> => {
  try {
    clearAuthFailure();
    // Create master key info (salt, iterations, etc.)
    const { masterKeyInfo: mkInfo, derivedKey: encryptionKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(masterPassword);

    // Save info to SecureStore
    await StorageService.saveMasterKeyInfo(mkInfo);

    // Set encryption key in memory
    StorageService.setEncryptionKey(encryptionKey);

    // Init DB (ensure it's ready)
    await StorageService.initDatabase();

    masterKeyInfo = mkInfo;
    isAuthenticated = true;

    return true;
  } catch (error) {
    Logger.error('AuthService: Error setting up master password', error);
    setAuthFailure('derive_key_failed', 'Master password setup failed');
    return false;
  }
};

/**
 * Checks if the master password is configured.
 */
export const isMasterPasswordConfigured = async (): Promise<boolean> => {
  try {
    const mkInfo = await StorageService.getMasterKeyInfo();
    return mkInfo !== null;
  } catch (error) {
    Logger.error('AuthService: Error checking master password config', error);
    return false;
  }
};

/**
 * Verifies a master password without changing authentication state.
 * Use this for reconfirmation in sensitive flows, such as PIN changes, when the user
 * is already authenticated and side effects on isAuthenticated/initDatabase are not desired.
 */
export const verifyMasterPassword = async (masterPassword: string): Promise<boolean> => {
  try {
    clearAuthFailure();
    const mkInfo = await StorageService.getMasterKeyInfo();
    if (!mkInfo) {
      setAuthFailure('master_key_info_missing', 'Master key info not found');
      return false;
    }
    const derivedKey = await deriveMasterKey(masterPassword, mkInfo);
    if (!derivedKey) {
      return false;
    }
    const isValid = CryptoService.verifyDerivedKey(derivedKey, mkInfo);
    if (!isValid) {
      setAuthFailure('verifier_mismatch', 'Master password verifier mismatch');
    }
    return isValid;
  } catch (error) {
    Logger.error('AuthService: verifyMasterPassword failed', error);
    setAuthFailure('derive_key_failed', 'Master password verification failed');
    return false;
  }
};

/**
 * Authenticates with the master password.
 */
export const loginWithMasterPassword = async (masterPassword: string): Promise<boolean> => {
  try {
    clearAuthFailure();
    const mkInfo = await StorageService.getMasterKeyInfo();

    if (!mkInfo) {
      setAuthFailure('master_key_info_missing', 'Master key info not found');
      return false;
    }

    const derivedKey = await deriveMasterKey(masterPassword, mkInfo);
    if (!derivedKey) {
      return false;
    }

    // Verify derived key without re-deriving (avoid double KDF work)
    const isValid = CryptoService.verifyDerivedKey(derivedKey, mkInfo);

    if (isValid) {
      StorageService.setEncryptionKey(derivedKey);
      try {
        await StorageService.initDatabase();
      } catch (error) {
        StorageService.setEncryptionKey('');
        setAuthFailure('init_database_failed', 'Database initialization failed after login');
        Logger.error('AuthService: initDatabase failed after master password login', error);
        return false;
      }
      masterKeyInfo = mkInfo;
      isAuthenticated = true;

      // Transparently migrate legacy/heavy KDFs to the lighter OWASP Argon2id
      // parameters now that the vault is unlocked. Best-effort: never fails login.
      await upgradeVaultKdfIfLegacy(masterPassword, mkInfo);

      return true;
    }

    setAuthFailure('verifier_mismatch', 'Master password verifier mismatch');
    return false;
  } catch (error) {
    Logger.error('AuthService: Error logging in with master password', error);
    setAuthFailure('derive_key_failed', 'Master password login failed');
    return false;
  }
};

/**
 * Authenticates with biometrics by reading the vault key from SecureStore.
 * SecureStore is configured with requireAuthentication, so this read is the
 * biometric/passcode gate for cold-start unlock.
 */
export const loginWithBiometrics = async (): Promise<boolean> => {
  try {
    clearAuthFailure();
    const { available } = await isBiometricsAvailable();
    if (!available) {
      setAuthFailure('biometrics_unavailable', 'Biometrics unavailable');
      return false;
    }

    // Check if we have biometrics enabled in preferences
    const prefs = await StorageService.getUserPreferences();
    if (!prefs.biometricsEnabled) {
      setAuthFailure('biometrics_disabled', 'Biometrics disabled in preferences');
      return false;
    }

    const biometricKey = await StorageService.getBiometricKey();
    if (!biometricKey) {
      await disableBiometrics(prefs);
      setAuthFailure('biometric_key_unavailable', 'Biometric key missing or invalidated');
      return false;
    }

    const mkInfo = await StorageService.getMasterKeyInfo();
    if (!mkInfo) {
      StorageService.setEncryptionKey('');
      setAuthFailure('master_key_info_missing', 'Master key info not found');
      return false;
    }

    if (!CryptoService.verifyDerivedKey(biometricKey, mkInfo)) {
      StorageService.setEncryptionKey('');
      await disableBiometrics(prefs);
      setAuthFailure('biometric_key_unavailable', 'Biometric key verifier mismatch');
      return false;
    }

    StorageService.setEncryptionKey(biometricKey);
    try {
      await StorageService.initDatabase();
    } catch (error) {
      StorageService.setEncryptionKey('');
      setAuthFailure(
        'init_database_failed',
        'Database initialization failed after biometric login',
      );
      Logger.error('AuthService: initDatabase failed after biometric login', error);
      return false;
    }

    masterKeyInfo = mkInfo;
    isAuthenticated = true;
    return true;
  } catch (error) {
    Logger.error('AuthService: Error logging in with biometrics', error);
    setAuthFailure('biometric_auth_failed', 'Biometric authentication failed');
    return false;
  }
};

/**
 * Enables biometric unlock for the current vault key.
 */
export const enableBiometrics = async (): Promise<boolean> => {
  try {
    clearAuthFailure();
    const { available, securityLevel } = await isBiometricsAvailable();
    if (!available) {
      setAuthFailure('biometrics_unavailable', 'Biometrics not available when trying to enable');
      return false;
    }

    Logger.info(`AuthService: Enabling biometrics. Security Level: ${securityLevel}`);

    const currentKey = StorageService.getEncryptionKey();
    if (!currentKey) {
      setAuthFailure('not_authenticated', 'Cannot enable biometrics without an active vault key');
      return false;
    }

    const promptMessage = isExpoGo
      ? 'Keysoft: Conferma Biometria (Simulazione Expo Go)'
      : 'Keysoft: Conferma Biometria';
    const success = await promptBiometricAuthentication(promptMessage);
    if (!success) {
      setAuthFailure('biometric_auth_failed', 'Biometric verification cancelled or failed');
      return false;
    }

    await StorageService.saveBiometricKey(currentKey);

    const prefs = await StorageService.getUserPreferences();
    await StorageService.saveUserPreferences({
      ...prefs,
      biometricsEnabled: true,
    });

    Logger.info('AuthService: Biometrics enabled successfully');
    return true;
  } catch (error) {
    Logger.error('AuthService: Error enabling biometrics', error);
    setAuthFailure('biometric_auth_failed', 'Error enabling biometrics');
    // Cleanup attempt
    try {
      await disableBiometrics();
    } catch (cleanupError) {
      Logger.warn('AuthService: Failed to clean biometric key', cleanupError);
    }
    return false;
  }
};

export const logout = async (): Promise<void> => {
  isAuthenticated = false;
  masterKeyInfo = null;
  clearAuthFailure();
  StorageService.setEncryptionKey(''); // clear key
};

export const getIsAuthenticated = (): boolean => {
  return isAuthenticated;
};

export const getLastAuthFailure = (): AuthFailure | null => {
  return lastAuthFailure;
};

export const authenticateWithMasterPassword = loginWithMasterPassword;

export const restoreBiometricsState = async (): Promise<boolean> => {
  const { available } = await isBiometricsAvailable();
  if (!available) return false;
  const prefs = await StorageService.getUserPreferences();
  return prefs.biometricsEnabled === true;
};

export const authenticateWithBiometrics = async (): Promise<BiometricAuthResult> => {
  // Web compatibility check
  const { available } = await isBiometricsAvailable();
  const prefs = await StorageService.getUserPreferences();

  if (!available || !prefs.biometricsEnabled) {
    return { success: false, error: 'Biometrics not available or disabled' };
  }

  // Android 16+ requires cancelLabel or fallbackLabel
  return LocalAuthentication.authenticateAsync({
    promptMessage: 'Autenticazione richiesta',
    cancelLabel: 'Annulla',
    fallbackLabel: 'Usa PIN',
  });
};

export const getMasterKeyInfo = (): UserMasterKey | null => {
  return masterKeyInfo;
};

export const updateMasterPassword = async (password: string): Promise<boolean> => {
  clearAuthFailure();
  Logger.info('AuthService: Starting master password update...');

  // 1. Ensure we have the current key (must be logged in)
  const currentKey = StorageService.getEncryptionKey();
  if (!currentKey) {
    setAuthFailure('not_authenticated', 'Cannot update password without an active vault key');
    return false;
  }

  // Snapshot of current state for rollback
  const oldMkInfo = masterKeyInfo;
  let dataReEncryptedWithNewKey = false;
  let newEncryptionKey: string | null = null;

  try {
    // 2. Create new Master Key Info
    const { masterKeyInfo: newMkInfo, derivedKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(password);
    newEncryptionKey = derivedKey;

    // 4. Re-encrypt all data with new key
    // This updates AsyncStorage AND the in-memory encryption key.
    await StorageService.reEncryptAllData(newEncryptionKey);
    dataReEncryptedWithNewKey = true;

    // 5. Save new Master Key Info
    // CRITICAL: If this fails, the rollback below restores the old encrypted state.
    await StorageService.saveMasterKeyInfo(newMkInfo);

    // 6. If Biometrics enabled, replace the stored biometric key with the new vault key.
    const prefs = await StorageService.getUserPreferences();
    if (prefs.biometricsEnabled) {
      try {
        await StorageService.saveBiometricKey(newEncryptionKey);
      } catch (biometricError) {
        Logger.warn('AuthService: Failed to update biometric key after PIN change', biometricError);
        await disableBiometrics(prefs);
      }
    }

    // 7. Update memory state
    masterKeyInfo = newMkInfo;
    StorageService.setEncryptionKey(newEncryptionKey);

    Logger.info('AuthService: Master password updated successfully');
    return true;
  } catch (error) {
    Logger.error('AuthService: Error updating master password', error);
    setAuthFailure('derive_key_failed', 'Master password update failed');

    // Rollback: if the data was already re-encrypted with the new key, restore old encryption.
    if (dataReEncryptedWithNewKey) {
      try {
        Logger.warn('AuthService: Attempting rollback to old encryption key...');
        await StorageService.reEncryptAllData(currentKey);
        StorageService.setEncryptionKey(currentKey);
        masterKeyInfo = oldMkInfo;
        Logger.info('AuthService: Rollback completed - vault restored to old key');
      } catch (rollbackError) {
        // Critical: rollback failed, so the vault may be inconsistent.
        // Force logout: the user must authenticate again and initDatabase will reload
        // the current state from disk. This is safer than continuing with in-memory state
        // that may be out of sync with AsyncStorage data.
        Logger.error(
          'AuthService: CRITICAL - rollback failed. Forcing logout to prevent data corruption.',
          rollbackError,
        );
        isAuthenticated = false;
        masterKeyInfo = null;
        StorageService.setEncryptionKey('');
      }
    }

    return false;
  }
};

// Add other methods as needed based on original file...
