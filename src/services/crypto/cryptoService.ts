import * as CryptoJS from 'crypto-js';
import { UserMasterKey } from '../../models/User';
import { isExpoGo } from '../../utils/env';
import Logger from '../../utils/logger';
import {
  bytesToBase64,
  bytesToHex,
  bytesToWordArray,
  getRandomBytes,
  randomInt,
} from '../../utils/cryptoRandom';
import { TimeoutError, withTimeout, KDF_TIMEOUT_MS } from '../../utils/withTimeout';

// require declaration for conditional imports
declare const require: any;

let argon2id:
  ((password: string, salt: string, options: Record<string, number>) => Promise<any>) | null = null;

function loadArgon2(): void {
  if (isExpoGo()) {
    argon2id = null;
    Logger.info('CryptoService: Expo Go detected. Using PBKDF2 fallback.');
    return;
  }

  try {
    const argon2Module = require('react-native-argon2');
    if (argon2Module && (argon2Module.default || argon2Module.argon2)) {
      argon2id = argon2Module.default || argon2Module.argon2;
      return;
    }

    argon2id = null;
    throw new Error('Argon2 module not found or null');
  } catch (error) {
    Logger.warn(
      'CryptoService: react-native-argon2 not available. PBKDF2 is allowed only for PBKDF2 metadata.',
      error,
    );
  }
}

loadArgon2();

// OWASP Argon2id minimum configuration (m = 19 MiB, t = 2, p = 1). Strong, but far
// lighter than the previous 64 MiB / t = 3, so unlocking is noticeably faster on
// entry-level phones and tablets while staying within OWASP guidance.
export const ARGON2_ITERATIONS = 2;
export const ARGON2_MEMORY_KB = 19456;

// PBKDF2 iteration count used only on Expo Go (no native Argon2 available).
const PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const MAX_ARGON2_ITERATIONS = 10;
const MIN_ARGON2_MEMORY_KB = 8 * 1024;
const MAX_ARGON2_MEMORY_KB = 256 * 1024;

/**
 * Whether the native Argon2 KDF is available (false on Expo Go). Used to decide
 * if a legacy vault can be transparently upgraded to the Argon2id parameters.
 */
export const isNativeKdfAvailable = (): boolean => !!argon2id;

function normalizeDerivedKeyInput(input: string | Uint8Array | number[]): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    const wordArray = CryptoJS.enc.Base64.parse(trimmed);
    return CryptoJS.enc.Hex.stringify(wordArray).toLowerCase();
  }

  if (input instanceof Uint8Array) {
    return bytesToHex(input).toLowerCase();
  }

  if (Array.isArray(input)) {
    return bytesToHex(Uint8Array.from(input)).toLowerCase();
  }

  throw new Error('Unsupported derived key format');
}

function ensureHexKey(keyHex: string): string {
  const normalized = keyHex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== 64) {
    throw new Error('Invalid derived key length');
  }
  return normalized;
}

interface PasswordEncryptedPayload {
  version: 'KS1-PW1';
  kdf: {
    salt: string;
    iterations: number;
    memory: number;
  };
  data: string;
}

export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

export type KdfErrorCode = 'ARGON2_UNAVAILABLE' | 'ARGON2_TIMEOUT' | 'KDF_FAILED';

export class KdfError extends Error {
  constructor(
    public readonly code: KdfErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'KdfError';
  }
}

function validateKdfParameters(iterations: number, memory: number): void {
  if (!Number.isSafeInteger(iterations) || !Number.isSafeInteger(memory) || memory < 0) {
    throw new KdfError('KDF_FAILED', 'Invalid KDF parameters');
  }

  if (memory === 0) {
    if (iterations < 0 || iterations > MAX_PBKDF2_ITERATIONS) {
      throw new KdfError('KDF_FAILED', 'Invalid PBKDF2 iteration count');
    }
    return;
  }

  if (
    iterations < 1 ||
    iterations > MAX_ARGON2_ITERATIONS ||
    memory < MIN_ARGON2_MEMORY_KB ||
    memory > MAX_ARGON2_MEMORY_KB
  ) {
    throw new KdfError('KDF_FAILED', 'Invalid Argon2 parameters');
  }
}

export interface MasterKeyInfoWithDerivedKey {
  masterKeyInfo: UserMasterKey;
  derivedKey: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
/**
 * Generates a random salt for key derivation.
 * @returns A base64 string containing the generated salt.
 */
export const generateSalt = (): string => {
  try {
    return bytesToBase64(getRandomBytes(16));
  } catch (error) {
    Logger.error('CryptoService: Errore durante la generazione del salt', error);
    throw new Error('Impossibile generare un salt sicuro');
  }
};

/**
 * Derives a key from the master password using Argon2id.
 * @param masterPassword The user master password.
 * @param salt The salt used for derivation.
 * @param iterations The Argon2 iteration count.
 * @param memory The Argon2 memory cost in KB.
 * @returns A Promise that resolves with the derived key.
 */
export const deriveKey = async (
  masterPassword: string,
  salt: string,
  iterations: number = ARGON2_ITERATIONS,
  memory: number = ARGON2_MEMORY_KB,
): Promise<string> => {
  try {
    validateKdfParameters(iterations, memory);

    // Only verifiers created with memory=0 use PBKDF2. If metadata requires
    // Argon2, do not fall back because that would produce a different key and look
    // like an invalid PIN.
    if (memory === 0) {
      // Use PBKDF2 with an appropriate iteration count
      // If iterations is very low (Argon2 metadata), use a safe PBKDF2 value
      const pbkdf2Iterations = iterations && iterations >= 1000 ? iterations : PBKDF2_ITERATIONS;
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: pbkdf2Iterations,
      });
      return ensureHexKey(key.toString(CryptoJS.enc.Hex));
    }

    if (!argon2id) {
      Logger.error('CryptoService: Argon2 metadata requires native KDF but module is unavailable');
      throw new KdfError('ARGON2_UNAVAILABLE', 'Native Argon2 KDF unavailable');
    }

    // Otherwise use Argon2id with a timeout to avoid indefinite blocking
    const result = await withTimeout(
      argon2id(masterPassword, salt, {
        iterations,
        memory,
        hashLength: 32, // 256 bit
        parallelism: 1,
      }),
      KDF_TIMEOUT_MS,
      'Argon2id key derivation',
    );
    const rawHash = result?.rawHash ?? result?.hash;
    const normalized = normalizeDerivedKeyInput(rawHash);
    return ensureHexKey(normalized);
  } catch (error) {
    if (error instanceof KdfError) {
      throw error;
    }

    if (error instanceof TimeoutError) {
      Logger.error('CryptoService: Argon2 key derivation timed out', error);
      throw new KdfError('ARGON2_TIMEOUT', 'Argon2 key derivation timed out', error);
    }

    Logger.error('CryptoService: Errore durante la derivazione della chiave', error);
    throw new KdfError('KDF_FAILED', 'Impossibile derivare la chiave dalla master password', error);
  }
};

/**
 * Creates a verifier for the master password.
 * @param masterPassword The user master password.
 * @returns A Promise that resolves with master-key metadata.
 */
export const createMasterKeyInfoWithDerivedKey = async (
  masterPassword: string,
): Promise<MasterKeyInfoWithDerivedKey> => {
  const salt = generateSalt();
  // Parameters depend on the available algorithm
  const usingArgon2 = !!argon2id;
  const iterations = usingArgon2 ? ARGON2_ITERATIONS : PBKDF2_ITERATIONS;
  const memory = usingArgon2 ? ARGON2_MEMORY_KB : 0;

  const derivedKey = await deriveKey(masterPassword, salt, iterations, memory);

  // Create a verifier for the master password
  const verifier = CryptoJS.SHA256(derivedKey).toString();

  return {
    masterKeyInfo: {
      salt,
      verifier,
      iterations,
      memory,
    },
    derivedKey,
  };
};

export const createMasterKeyInfo = async (masterPassword: string): Promise<UserMasterKey> => {
  const { masterKeyInfo } = await createMasterKeyInfoWithDerivedKey(masterPassword);
  return masterKeyInfo;
};

/**
 * Returns true when a vault uses a legacy KDF configuration (PBKDF2 with memory=0,
 * or the old heavy Argon2 parameters). Such vaults are transparently upgraded to the
 * current Argon2id parameters on the next successful login.
 */
export const isLegacyKdf = (masterKeyInfo: UserMasterKey): boolean =>
  masterKeyInfo.memory !== ARGON2_MEMORY_KB || masterKeyInfo.iterations !== ARGON2_ITERATIONS;

/**
 * Verifies whether the master password is correct.
 * @param masterPassword The master password to verify.
 * @param masterKeyInfo The master-key metadata.
 * @returns A Promise that resolves with whether the password is correct.
 */
export const verifyMasterPassword = async (
  masterPassword: string,
  masterKeyInfo: UserMasterKey,
): Promise<boolean> => {
  try {
    const { salt, verifier, iterations, memory } = masterKeyInfo;
    const derivedKey = await deriveKey(masterPassword, salt, iterations, memory);
    const computedVerifier = CryptoJS.SHA256(derivedKey).toString();

    return constantTimeEqual(computedVerifier, verifier);
  } catch (error) {
    Logger.error('CryptoService: Errore durante la verifica della master password', error);
    return false;
  }
};

export const verifyDerivedKey = (derivedKey: string, masterKeyInfo: UserMasterKey): boolean => {
  try {
    const computedVerifier = CryptoJS.SHA256(derivedKey).toString();
    return constantTimeEqual(computedVerifier, masterKeyInfo.verifier);
  } catch (error) {
    Logger.error('CryptoService: Errore durante la verifica della chiave derivata', error);
    return false;
  }
};

/**
 * Encrypts text with AES-256 using the KS1 encrypt-then-MAC scheme.
 * @param text The text to encrypt.
 * @param key The encryption key.
 * @returns The encrypted text as a string.
 */
export const encrypt = async (text: string, key: string): Promise<string> => {
  try {
    const keyWA = CryptoJS.enc.Hex.parse(ensureHexKey(key));
    const iv = bytesToWordArray(getRandomBytes(16));

    // AES-CBC Encryption
    const encrypted = CryptoJS.AES.encrypt(text, keyWA, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const ct = (encrypted as any).ciphertext; // Ciphertext WordArray

    // HMAC-SHA256 for integrity (Encrypt-then-MAC)
    const mac = CryptoJS.HmacSHA256(iv.clone().concat(ct.clone()), keyWA);

    // Payload: IV + Ciphertext + MAC
    const payload = iv.clone().concat(ct.clone()).concat(mac.clone());
    const b64 = CryptoJS.enc.Base64.stringify(payload);

    return `KS1:${b64}`;
  } catch (error) {
    Logger.error('CryptoService: Encryption failed', error);
    throw new CryptoError('Encryption failed', error);
  }
};

/**
 * Decrypts text with AES-256.
 * @param encryptedText The encrypted text. An empty string returns an empty string.
 * @param key The decryption key.
 * @returns The decrypted text.
 * @throws {CryptoError} If decryption fails because of a wrong key, corrupted data, or an invalid MAC.
 */
export const decrypt = async (encryptedText: string, key: string): Promise<string> => {
  // Empty input returns empty output; this is valid when no data has been saved
  if (!encryptedText) return '';

  // 1) KS1 schema (authenticated encryption)
  if (encryptedText.startsWith('KS1:')) {
    try {
      const b64 = encryptedText.substring(4);
      const payload = CryptoJS.enc.Base64.parse(b64);
      const keyWA = CryptoJS.enc.Hex.parse(ensureHexKey(key));

      // Minimum length check: IV (4 words) + MAC (8 words)
      if (payload.words.length < 12) {
        throw new CryptoError('Invalid payload length');
      }

      // Extract components
      // IV is first 4 words (16 bytes)
      const iv = CryptoJS.lib.WordArray.create(payload.words.slice(0, 4), 16);

      // MAC is last 8 words (32 bytes)
      const macIndex = payload.words.length - 8;
      const mac = CryptoJS.lib.WordArray.create(payload.words.slice(macIndex), 32);

      // Ciphertext is everything in between
      const ct = CryptoJS.lib.WordArray.create(
        payload.words.slice(4, macIndex),
        payload.sigBytes - 48,
      );

      // Verify MAC (constant-time comparison)
      const computedMac = CryptoJS.HmacSHA256(iv.clone().concat(ct.clone()), keyWA);
      if (!constantTimeEqual(computedMac.toString(), mac.toString())) {
        Logger.error('CryptoService: MAC verification failed (Integrity Check)');
        throw new CryptoError('MAC verification failed');
      }

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt({ ciphertext: ct } as any, keyWA, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      // CryptoJS can return an empty string for invalid padding without throwing
      if (!plaintext && ct.sigBytes > 0) {
        throw new CryptoError('Decryption produced empty plaintext (likely invalid padding)');
      }
      return plaintext;
    } catch (e) {
      if (e instanceof CryptoError) throw e;
      Logger.error('CryptoService: Decryption KS1 failed', e);
      throw new CryptoError('Decryption failed', e);
    }
  }

  // 2) Legacy AES (Keep for migration)
  // This branch is only used to read legacy data that has not been migrated yet.
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;
    throw new CryptoError('Legacy decryption produced empty plaintext');
  } catch (e) {
    if (e instanceof CryptoError) throw e;
    Logger.error('CryptoService: Legacy decryption failed', e);
    throw new CryptoError('Legacy decryption failed', e);
  }
};

export const encryptWithPassword = async (text: string, password: string): Promise<string> => {
  const salt = generateSalt();
  const iterations = 100_000;
  const memory = 0;
  const derivedKey = await deriveKey(password, salt, iterations, memory);

  const payload: PasswordEncryptedPayload = {
    version: 'KS1-PW1',
    kdf: {
      salt,
      iterations,
      memory,
    },
    data: await encrypt(text, derivedKey),
  };

  return JSON.stringify(payload);
};

export const decryptWithPassword = async (
  payloadJson: string,
  password: string,
): Promise<string> => {
  try {
    const payload = JSON.parse(payloadJson) as Partial<PasswordEncryptedPayload>;
    if (
      payload.version !== 'KS1-PW1' ||
      !payload.kdf ||
      typeof payload.kdf.salt !== 'string' ||
      typeof payload.kdf.iterations !== 'number' ||
      typeof payload.kdf.memory !== 'number' ||
      typeof payload.data !== 'string'
    ) {
      throw new Error('Invalid backup password or payload');
    }

    const derivedKey = await deriveKey(
      password,
      payload.kdf.salt,
      payload.kdf.iterations,
      payload.kdf.memory,
    );
    const decrypted = await decrypt(payload.data, derivedKey);
    if (!decrypted) {
      throw new Error('Invalid backup password or payload');
    }

    return decrypted;
  } catch (error) {
    Logger.warn('CryptoService: Password-encrypted backup decryption failed', error);
    throw new Error('Invalid backup password or payload');
  }
};

export interface PasswordGeneratorOptions {
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeSimilarCharacters?: boolean;
}

export const generatePassword = (length: number, options: PasswordGeneratorOptions): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const similar = 'il1Lo0O';

  // Apply the "exclude similar characters" option to every alphabet, so the
  // characters guaranteed below cannot reintroduce a look-alike the user excluded.
  const applyExclusions = (source: string): string =>
    options.excludeSimilarCharacters
      ? source
          .split('')
          .filter((char) => !similar.includes(char))
          .join('')
      : source;

  const selectedAlphabets: string[] = [];
  if (options.includeLowercase) selectedAlphabets.push(applyExclusions(lowercase));
  if (options.includeUppercase) selectedAlphabets.push(applyExclusions(uppercase));
  if (options.includeNumbers) selectedAlphabets.push(applyExclusions(numbers));
  if (options.includeSymbols) selectedAlphabets.push(applyExclusions(symbols));

  // An alphabet can in principle be emptied by the exclusion filter; picking from
  // it would throw, so only non-empty alphabets can guarantee a character.
  const minimumChars = selectedAlphabets.filter((alphabet) => alphabet.length > 0);
  const chars = minimumChars.join('');

  if (chars.length === 0) return '';

  function pickChar(source: string): string {
    return source.charAt(randomInt(source.length));
  }

  // Never emit more characters than requested: when the requested length is shorter
  // than the number of selected alphabets, only the first ones can be guaranteed.
  let password = minimumChars
    .slice(0, Math.max(0, length))
    .map((source) => pickChar(source))
    .join('');

  for (let i = password.length; i < length; i++) {
    password += chars.charAt(randomInt(chars.length));
  }

  const passwordChars = password.split('');
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
};

export const generateSecurePassword = (
  length: number,
  options: PasswordGeneratorOptions,
): string => {
  return generatePassword(length, options);
};
