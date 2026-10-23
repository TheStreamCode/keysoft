import * as LocalAuthentication from 'expo-local-authentication';
import * as CryptoService from '../crypto/cryptoService';
import * as StorageService from '../storage/storageService';
import { UserMasterKey } from '../../models/User';
import { isExpoGo as isExpoGoEnvironment } from '../../utils/env';
import Logger from '../../utils/logger';

// State
let isAuthenticated = false;
let masterKeyInfo: UserMasterKey | null = null;
let lastAuthFailure: AuthFailure | null = null;
// Serialises rekey operations in-process: two concurrent rekeys would each write their
// own recovery record and could commit the wrong metadata for the other's ciphertext.
let isVaultRekeyInProgress = false;

const isExpoGo = isExpoGoEnvironment();

export type TBiometryTypes = 'TouchID' | 'FaceID' | 'Biometrics';
export type AuthFailureReason =
  | 'master_key_info_missing'
  | 'native_kdf_unavailable'
  | 'kdf_timeout'
  | 'derive_key_failed'
  | 'verifier_mismatch'
  | 'init_database_failed'
  | 'kdf_upgrade_rollback_failed'
  | 'kdf_recovery_pending'
  | 'kdf_recovery_requires_new_password'
  | 'kdf_recovery_requires_previous_password'
  | 'biometrics_unavailable'
  | 'biometrics_disabled'
  | 'biometric_key_unavailable'
  | 'biometric_auth_failed'
  | 'not_authenticated'
  | 'master_key_already_configured';

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
  const startedAt = Date.now();
  try {
    const key = await CryptoService.deriveKey(
      masterPassword,
      mkInfo.salt,
      mkInfo.iterations,
      mkInfo.memory,
    );
    Logger.debug(`AuthService: KDF completed in ${Date.now() - startedAt}ms`);
    return key;
  } catch (error) {
    Logger.debug(`AuthService: KDF failed after ${Date.now() - startedAt}ms`);
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
 * Derives a key without recording an authentication failure. Crash recovery has to try
 * the password against both the active and the pending metadata, and a mismatch is a
 * normal outcome there, not a login error.
 */
async function tryDeriveKey(masterPassword: string, mkInfo: UserMasterKey): Promise<string | null> {
  try {
    return await CryptoService.deriveKey(
      masterPassword,
      mkInfo.salt,
      mkInfo.iterations,
      mkInfo.memory,
    );
  } catch (error) {
    Logger.warn(
      'AuthService: key derivation failed while reconciling a pending KDF migration',
      error,
    );
    return null;
  }
}

class VaultRekeyRollbackError extends Error {
  constructor(public readonly cause?: unknown) {
    super('Vault re-encryption rollback failed');
    this.name = 'VaultRekeyRollbackError';
  }
}

/**
 * Rekeys the whole vault and commits the new master-key metadata as one crash-safe
 * sequence:
 *  1. persist a recovery record describing the new metadata while the previous metadata
 *     is still active and still derivable from the previous password;
 *  2. re-encrypt the vault (batched write, transactional on Android);
 *  3. commit the new metadata with a single SecureStore write.
 * A process kill before (3) leaves the previous metadata usable, and the recovery record
 * lets the next password login either roll the vault back or finish the promotion. A
 * kill after (3) only leaves a stale recovery record that the next login removes.
 */
async function rekeyVaultWithRecoveryRecord(
  newMasterKeyInfo: UserMasterKey,
  newKey: string,
  previousKey: string,
): Promise<void> {
  await StorageService.savePendingMasterKeyMigration({
    masterKeyInfo: newMasterKeyInfo,
    startedAt: Date.now(),
  });

  try {
    await StorageService.reEncryptAllData(newKey);
  } catch (error) {
    // The vault still uses the previous key. Drop the recovery record; if deleting it
    // fails, the next login removes it once it sees the vault decrypt with the active key.
    await StorageService.deletePendingMasterKeyMigration();
    StorageService.setEncryptionKey(previousKey);
    throw error;
  }

  try {
    await StorageService.saveMasterKeyInfo(newMasterKeyInfo);
  } catch (error) {
    // The vault is on the new key while the active metadata still describes the old one.
    // Roll the ciphertext back so the previous password keeps working.
    try {
      await StorageService.reEncryptAllData(previousKey);
      StorageService.setEncryptionKey(previousKey);
      await StorageService.deletePendingMasterKeyMigration();
    } catch (rollbackError) {
      // Keep the recovery record: the next password login can still finish the promotion.
      Logger.error(
        'AuthService: CRITICAL - vault re-encryption rollback failed after a metadata commit error',
        rollbackError,
      );
      throw new VaultRekeyRollbackError(rollbackError);
    }
    throw error;
  }

  await StorageService.deletePendingMasterKeyMigration();
  StorageService.setEncryptionKey(newKey);
}

/**
 * Makes the biometric vault key match the active key after a crash recovery. Best-effort:
 * the password change is already durable and must stay successful even if this fails.
 */
async function refreshBiometricKeyAfterKdfRecovery(vaultKey: string): Promise<void> {
  try {
    const prefs = await StorageService.getUserPreferences();
    if (!prefs.biometricsEnabled) {
      return;
    }

    try {
      await StorageService.saveBiometricKey(vaultKey);
    } catch (biometricError) {
      Logger.warn(
        'AuthService: failed to refresh biometric key after KDF recovery',
        biometricError,
      );
      try {
        await disableBiometrics(prefs);
      } catch (cleanupError) {
        Logger.warn('AuthService: failed to disable biometrics after KDF recovery', cleanupError);
      }
    }
  } catch (error) {
    Logger.warn('AuthService: failed to read preferences after KDF recovery', error);
  }
}

interface PendingKdfRecoveryResult {
  masterKeyInfo: UserMasterKey;
  vaultKey: string;
}

/**
 * Resolves a recovery record left by an interrupted KDF upgrade or master-password
 * update. The vault may have been written with the previous key, with the pending key,
 * or not yet touched at all, so both passwords are checked against both metadata records
 * and the vault records are inspected with the keys that actually derive.
 */
async function recoverPendingKdfMigration(
  masterPassword: string,
  activeMasterKeyInfo: UserMasterKey,
  activeDerivedKey: string,
  isActivePasswordValid: boolean,
  pendingMigration: StorageService.PendingMasterKeyMigration,
): Promise<PendingKdfRecoveryResult | null> {
  const pendingMasterKeyInfo = pendingMigration.masterKeyInfo;
  const pendingDerivedKey = await tryDeriveKey(masterPassword, pendingMasterKeyInfo);
  const isPendingPasswordValid = pendingDerivedKey
    ? CryptoService.verifyDerivedKey(pendingDerivedKey, pendingMasterKeyInfo)
    : false;

  const activeVaultDecrypts =
    isActivePasswordValid && (await StorageService.canDecryptVaultWithKey(activeDerivedKey));
  const pendingVaultDecrypts =
    isPendingPasswordValid && pendingDerivedKey !== null
      ? await StorageService.canDecryptVaultWithKey(pendingDerivedKey)
      : false;

  if (isActivePasswordValid && activeVaultDecrypts) {
    // The vault still matches the active metadata: the crash happened before the vault
    // write, or the record is stale after a committed rekey. Drop it and log in.
    await StorageService.deletePendingMasterKeyMigration();
    Logger.info('AuthService: discarded a stale pending KDF migration; vault unchanged');
    return {
      masterKeyInfo: activeMasterKeyInfo,
      vaultKey: activeDerivedKey,
    };
  }

  if (isPendingPasswordValid && pendingDerivedKey !== null && pendingVaultDecrypts) {
    // The vault was re-encrypted before the crash: commit the pending metadata first.
    // That single SecureStore write is the point where the new key becomes derivable
    // from stored metadata; until it succeeds the recovery record is kept intact.
    try {
      await StorageService.saveMasterKeyInfo(pendingMasterKeyInfo);
    } catch (error) {
      Logger.error('AuthService: failed to commit recovered KDF metadata', error);
      setAuthFailure('kdf_recovery_pending', 'Could not persist recovered vault metadata');
      return null;
    }
    await StorageService.deletePendingMasterKeyMigration();
    Logger.info('AuthService: completed a pending KDF migration after crash recovery');
    return {
      masterKeyInfo: pendingMasterKeyInfo,
      vaultKey: pendingDerivedKey,
    };
  }

  if (isActivePasswordValid && !activeVaultDecrypts) {
    if (isPendingPasswordValid) {
      // The same password derives both metadata records, yet the vault decrypts with
      // neither key: the records are unreadable or corrupted. Keep the recovery record.
      setAuthFailure('init_database_failed', 'Vault records are unreadable after crash recovery');
      return null;
    }
    // The previous password still matches the active metadata, but the vault is already
    // on the new key. Only the password chosen during the interrupted change can open it.
    setAuthFailure(
      'kdf_recovery_requires_new_password',
      'Vault already re-encrypted with the new password',
    );
    return null;
  }

  if (isPendingPasswordValid) {
    // The new password matches the pending metadata, but the vault was not re-encrypted
    // before the crash: the previous password still opens it.
    setAuthFailure(
      'kdf_recovery_requires_previous_password',
      'Vault still requires the previous password',
    );
    return null;
  }

  setAuthFailure('verifier_mismatch', 'Master password verifier mismatch');
  return null;
}

/**
 * Loads the decrypted vault with a verified key and completes the post-login steps.
 * Shared by the regular password flow and crash recovery.
 */
async function completePasswordLogin(
  masterPassword: string,
  mkInfo: UserMasterKey,
  derivedKey: string,
): Promise<boolean> {
  StorageService.setEncryptionKey(derivedKey);
  try {
    const storageStartedAt = Date.now();
    await StorageService.initDatabase();
    Logger.debug(
      `AuthService: encrypted vault load completed in ${Date.now() - storageStartedAt}ms`,
    );
  } catch (error) {
    StorageService.setEncryptionKey('');
    setAuthFailure('init_database_failed', 'Database initialization failed after login');
    Logger.error('AuthService: initDatabase failed after master password login', error);
    return false;
  }

  masterKeyInfo = mkInfo;
  isAuthenticated = true;

  // Transparently migrate legacy/heavy KDFs to the lighter OWASP Argon2id parameters now
  // that the vault is unlocked. Recoverable failures do not fail login; an unrecoverable
  // rollback closes the session to avoid using an uncertain key.
  const kdfUpgradeSafe = await upgradeVaultKdfIfLegacy(masterPassword, mkInfo);
  if (!kdfUpgradeSafe) {
    return false;
  }

  return true;
}

/**
 * Best-effort, non-destructive upgrade of a legacy vault (PBKDF2 or the old heavy
 * Argon2 parameters) to the current Argon2id parameters. Runs after a successful
 * password login while the vault is decrypted in memory. On any failure the vault is
 * left on its previous (working) key, so the user is never locked out and the upgrade
 * simply retries on the next login. If both metadata persistence and rollback fail, the
 * session is closed because continuing with an uncertain key would risk further writes.
 */
async function upgradeVaultKdfIfLegacy(
  masterPassword: string,
  mkInfo: UserMasterKey,
): Promise<boolean> {
  if (!CryptoService.isNativeKdfAvailable()) return true; // Expo Go: cannot derive Argon2
  if (!CryptoService.isLegacyKdf(mkInfo)) return true;
  if (isVaultRekeyInProgress) return true;

  const currentKey = StorageService.getEncryptionKey();
  if (!currentKey) return true;

  isVaultRekeyInProgress = true;
  try {
    Logger.info('AuthService: upgrading vault KDF to current Argon2id parameters');

    // Read preferences before changing either side of the vault transaction. A
    // preference read failure must not leave ciphertext and verifier metadata out of sync.
    const prefs = await StorageService.getUserPreferences();

    const { masterKeyInfo: newMkInfo, derivedKey: newKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(masterPassword);

    try {
      // Recovery record, then batched vault write, then atomic metadata commit.
      await rekeyVaultWithRecoveryRecord(newMkInfo, newKey, currentKey);
    } catch (error) {
      if (error instanceof VaultRekeyRollbackError) {
        // The vault may be inconsistent; end the session and keep the recovery record so
        // the next password login can complete the promotion instead of losing the vault.
        Logger.error(
          'AuthService: CRITICAL - KDF upgrade rollback failed. Forcing logout to protect vault integrity.',
          error,
        );
        isAuthenticated = false;
        masterKeyInfo = null;
        StorageService.setEncryptionKey('');
        setAuthFailure('kdf_upgrade_rollback_failed', 'Vault KDF upgrade rollback failed');
        return false;
      }
      throw error;
    }

    // Ciphertext and verifier metadata are now committed as one logical unit.
    // Update authentication state before optional biometric maintenance so a
    // SecureStore cleanup failure can never trigger a vault rollback.
    masterKeyInfo = newMkInfo;
    StorageService.setEncryptionKey(newKey);

    // Keep biometric unlock working by storing the new vault key. This is
    // deliberately best-effort after the core vault transaction has committed.
    if (prefs.biometricsEnabled) {
      try {
        await StorageService.saveBiometricKey(newKey);
      } catch (biometricError) {
        Logger.warn(
          'AuthService: failed to refresh biometric key after KDF upgrade',
          biometricError,
        );
        try {
          await disableBiometrics(prefs);
        } catch (cleanupError) {
          Logger.warn('AuthService: failed to disable biometrics after KDF upgrade', cleanupError);
        }
      }
    }

    Logger.info('AuthService: vault KDF upgrade completed');
    return true;
  } catch (error) {
    Logger.warn('AuthService: vault KDF upgrade skipped (will retry next login)', error);
    return true;
  } finally {
    isVaultRekeyInProgress = false;
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
  let hasPersistedNewMasterKeyInfo = false;
  try {
    clearAuthFailure();
    const existingMasterKeyInfo = await StorageService.getMasterKeyInfo();
    if (existingMasterKeyInfo) {
      setAuthFailure('master_key_already_configured', 'Master password is already configured');
      return false;
    }

    // A recovery record cannot be reconciled without active metadata; drop any leftover
    // from an interrupted setup before creating a fresh vault.
    if (await StorageService.getPendingMasterKeyMigration()) {
      await StorageService.deletePendingMasterKeyMigration();
    }

    // Create master key info (salt, iterations, etc.)
    const { masterKeyInfo: mkInfo, derivedKey: encryptionKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(masterPassword);

    // Save info to SecureStore
    await StorageService.saveMasterKeyInfo(mkInfo);
    hasPersistedNewMasterKeyInfo = true;

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
    isAuthenticated = false;
    masterKeyInfo = null;
    StorageService.setEncryptionKey('');

    if (hasPersistedNewMasterKeyInfo) {
      try {
        await StorageService.deleteMasterKeyInfo();
      } catch (cleanupError) {
        Logger.error(
          'AuthService: Failed to roll back incomplete master password setup',
          cleanupError,
        );
      }
    }
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
  const loginStartedAt = Date.now();
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
    const pendingMigration = await StorageService.getPendingMasterKeyMigration();

    if (pendingMigration) {
      // Crash recovery takes precedence over the regular flow: the vault may already be
      // encrypted with the pending key while the active metadata still describes the old one.
      const recovered = await recoverPendingKdfMigration(
        masterPassword,
        mkInfo,
        derivedKey,
        isValid,
        pendingMigration,
      );
      if (!recovered) {
        return false;
      }

      const loginSucceeded = await completePasswordLogin(
        masterPassword,
        recovered.masterKeyInfo,
        recovered.vaultKey,
      );
      if (loginSucceeded) {
        // The interrupted rekey may have committed after the biometric key was last
        // written; refresh it so biometric unlock keeps working. Writing the current key
        // again is harmless when recovery rolled the vault back instead.
        await refreshBiometricKeyAfterKdfRecovery(recovered.vaultKey);
        Logger.debug(`AuthService: password login completed in ${Date.now() - loginStartedAt}ms`);
      }
      return loginSucceeded;
    }

    if (!isValid) {
      setAuthFailure('verifier_mismatch', 'Master password verifier mismatch');
      return false;
    }

    const loginSucceeded = await completePasswordLogin(masterPassword, mkInfo, derivedKey);
    if (!loginSucceeded) {
      return false;
    }

    Logger.debug(`AuthService: password login completed in ${Date.now() - loginStartedAt}ms`);

    return true;
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

    // A pending KDF migration can only be reconciled with the master password. Do not
    // read or disable the biometric key here: the password login may still promote it.
    const pendingMigration = await StorageService.getPendingMasterKeyMigration();
    if (pendingMigration) {
      setAuthFailure(
        'kdf_recovery_pending',
        'A pending vault security upgrade requires the master password',
      );
      return false;
    }

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

  if (isVaultRekeyInProgress) {
    Logger.warn('AuthService: ignoring master password update while a vault rekey is in progress');
    return false;
  }

  let newEncryptionKey: string | null = null;
  let prefs: Awaited<ReturnType<typeof StorageService.getUserPreferences>>;

  isVaultRekeyInProgress = true;
  try {
    // Resolve optional side-effect state before changing encrypted storage. If
    // this read fails, the vault remains untouched.
    prefs = await StorageService.getUserPreferences();

    // A recovery record here can only be stale: password login reconciles it and
    // biometric login refuses to run while one exists. Drop it before recording the
    // new migration so its companion metadata cannot be overwritten.
    await StorageService.deletePendingMasterKeyMigration();

    // 2. Create new Master Key Info
    const { masterKeyInfo: newMkInfo, derivedKey } =
      await CryptoService.createMasterKeyInfoWithDerivedKey(password);
    newEncryptionKey = derivedKey;

    // 3. Recovery record, then batched vault write, then atomic metadata commit.
    // A process kill between the vault write and the commit is reconciled on the next
    // password login instead of leaving ciphertext whose salt was never persisted.
    await rekeyVaultWithRecoveryRecord(newMkInfo, derivedKey, currentKey);

    // 4. Ciphertext and verifier metadata are committed. Update in-memory state
    // before optional biometric maintenance so later cleanup failures cannot
    // roll the vault back while leaving the new verifier in SecureStore.
    masterKeyInfo = newMkInfo;
    StorageService.setEncryptionKey(derivedKey);
  } catch (error) {
    Logger.error('AuthService: Error updating master password', error);
    setAuthFailure('derive_key_failed', 'Master password update failed');

    if (error instanceof VaultRekeyRollbackError) {
      // Critical: the vault may be inconsistent. Force logout: the user must
      // authenticate again and initDatabase will reload the persisted state. The recovery
      // record is kept so the next password login can still complete the promotion.
      Logger.error(
        'AuthService: CRITICAL - rollback failed. Forcing logout to prevent data corruption.',
        error,
      );
      isAuthenticated = false;
      masterKeyInfo = null;
      StorageService.setEncryptionKey('');
    }

    return false;
  } finally {
    isVaultRekeyInProgress = false;
  }

  // 5. Biometric persistence is a separate, best-effort transaction. The
  // password change is already durable and must remain successful even if the
  // biometric key or its cleanup cannot be written.
  if (prefs.biometricsEnabled && newEncryptionKey) {
    try {
      await StorageService.saveBiometricKey(newEncryptionKey);
    } catch (biometricError) {
      Logger.warn('AuthService: Failed to update biometric key after PIN change', biometricError);
      try {
        await disableBiometrics(prefs);
      } catch (cleanupError) {
        Logger.warn('AuthService: Failed to disable biometrics after PIN change', cleanupError);
      }
    }
  }

  Logger.info('AuthService: Master password updated successfully');
  return true;
};

// Add other methods as needed based on original file...
