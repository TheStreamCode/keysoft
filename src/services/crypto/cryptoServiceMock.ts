import * as CryptoJS from 'crypto-js';
import { UserMasterKey } from '../../models/User';
import Logger from '../../utils/logger';
import { randomInt } from '../../utils/cryptoRandom';

class CryptoServiceMock {
  /**
   * Generates an encryption key derived from the master password
   */
  static deriveKeyFromPassword(password: string, salt: string, iterations: number = 10000): string {
    // Use CryptoJS to derive a key from the password
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations,
    });
    return key.toString(CryptoJS.enc.Hex);
  }

  /**
   * Derives a key from the master password, compatible with the original service API
   */
  static async deriveKey(
    masterPassword: string,
    salt: string,
    iterations: number = 3,
    _memory: number = 65536,
  ): Promise<string> {
    // Use PBKDF2; if iterations is low, raise it to a safe value
    const pbkdf2Iterations = iterations && iterations >= 1000 ? iterations : 100_000;
    return this.deriveKeyFromPassword(masterPassword, salt, pbkdf2Iterations);
  }

  /**
   * Creates master-key metadata
   */
  static async createMasterKeyInfoWithDerivedKey(masterPassword: string): Promise<{
    masterKeyInfo: UserMasterKey;
    derivedKey: string;
  }> {
    const salt = this.generateSalt();
    // Reduced to 10k for acceptable Expo Go performance in pure JS
    // Production native builds with Argon2 use stronger parameters
    const iterations = 10_000;
    const memory = 0;

    // Derive the key
    const derivedKey = await this.deriveKey(masterPassword, salt, iterations, memory);

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
  }

  static async createMasterKeyInfo(masterPassword: string): Promise<UserMasterKey> {
    const { masterKeyInfo } = await this.createMasterKeyInfoWithDerivedKey(masterPassword);
    return masterKeyInfo;
  }

  /**
   * Verifies whether the master password is correct
   */
  static async verifyMasterPassword(
    masterPassword: string,
    masterKeyInfo: UserMasterKey,
  ): Promise<boolean> {
    try {
      const { salt, verifier, iterations, memory } = masterKeyInfo;
      const derivedKey = await this.deriveKey(masterPassword, salt, iterations, memory);
      const computedVerifier = CryptoJS.SHA256(derivedKey).toString();

      return computedVerifier === verifier;
    } catch (error) {
      Logger.error('Errore durante la verifica della master password:', error);
      return false;
    }
  }

  static verifyDerivedKey(derivedKey: string, masterKeyInfo: UserMasterKey): boolean {
    try {
      const computedVerifier = CryptoJS.SHA256(derivedKey).toString();
      return computedVerifier === masterKeyInfo.verifier;
    } catch (error) {
      Logger.error('Errore durante la verifica della chiave derivata:', error);
      return false;
    }
  }

  /**
   * Generates a random salt
   */
  static generateSalt(length: number = 16): string {
    const random = CryptoJS.lib.WordArray.random(length);
    return random.toString(CryptoJS.enc.Base64);
  }

  /**
   * Encrypts text with AES-256.
   * @param text The text to encrypt.
   * @param key The encryption key.
   * @returns The encrypted text as a string.
   */
  static encrypt(text: string, key: string): string {
    try {
      const keyWA = CryptoJS.enc.Hex.parse(key);
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(text, keyWA, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      const ct = encrypted.ciphertext;
      const mac = CryptoJS.HmacSHA256(iv.clone().concat(ct.clone()), keyWA);
      const payload = iv.clone().concat(ct.clone()).concat(mac.clone());
      const b64 = CryptoJS.enc.Base64.stringify(payload);
      return `KS1:${b64}`;
    } catch (error) {
      Logger.warn('Fallback per crittografia mock:', error);
      return CryptoJS.AES.encrypt(text, key).toString();
    }
  }

  /**
   * Decrypts text encrypted with AES-256.
   * @param encryptedText The encrypted text.
   * @param key The decryption key.
   * @returns The decrypted text.
   */
  static decrypt(encryptedText: string, key: string): string {
    try {
      if (encryptedText.indexOf('KS1:') === 0) {
        const b64 = encryptedText.substring(4);
        const payload = CryptoJS.enc.Base64.parse(b64);
        const keyWA = CryptoJS.enc.Hex.parse(key);
        const iv = CryptoJS.lib.WordArray.create(payload.words.slice(0, 4), 16);
        const totalBytes = payload.sigBytes;
        const macBytes = 32;
        const ctBytes = totalBytes - 16 - macBytes;
        const ct = CryptoJS.lib.WordArray.create(
          payload.words.slice(4, 4 + Math.ceil(ctBytes / 4)),
          ctBytes,
        );
        const mac = CryptoJS.lib.WordArray.create(
          payload.words.slice(
            4 + Math.ceil(ctBytes / 4),
            4 + Math.ceil(ctBytes / 4) + Math.ceil(macBytes / 4),
          ),
          macBytes,
        );
        const macCheck = CryptoJS.HmacSHA256(iv.clone().concat(ct.clone()), keyWA);
        if (mac.toString() !== macCheck.toString()) throw new Error('MAC non valido');
        const decrypted = CryptoJS.AES.decrypt({ ciphertext: ct } as any, keyWA, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
      }
      // Legacy fallback: AES passphrase
      const bytes = CryptoJS.AES.decrypt(encryptedText, key);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (!result) throw new Error('Decrittografia fallita');
      return result;
    } catch (error) {
      Logger.error('Errore durante la decrittografia mock:', error);
      throw error;
    }
  }

  /**
   * Generates a password hash
   */
  static hashPassword(password: string, salt: string): string {
    // Use CryptoJS to generate the password hash
    return CryptoJS.SHA256(password + salt).toString();
  }

  /**
   * Verifies whether a password matches a hash
   */
  static verifyPassword(password: string, salt: string, hash: string): boolean {
    const calculatedHash = this.hashPassword(password, salt);
    return calculatedHash === hash;
  }

  /**
   * Generates a secure password
   */
  static generateSecurePassword(
    length: number = 16,
    includeUppercase: boolean = true,
    includeLowercase: boolean = true,
    includeNumbers: boolean = true,
    includeSpecialChars: boolean = true,
  ): string {
    // Define character sets
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    // Build the character set to use
    let chars = '';
    if (includeUppercase) chars += uppercaseChars;
    if (includeLowercase) chars += lowercaseChars;
    if (includeNumbers) chars += numberChars;
    if (includeSpecialChars) chars += specialChars;

    // If no set is selected, use lowercase letters and numbers
    if (chars === '') chars = lowercaseChars + numberChars;

    // Generate the password
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(randomInt(chars.length));
    }

    // Ensure the password includes at least one character from every requested set
    let finalPassword = password;
    if (includeUppercase && !finalPassword.match(/[A-Z]/)) {
      finalPassword =
        uppercaseChars.charAt(randomInt(uppercaseChars.length)) + finalPassword.slice(1);
    }
    if (includeLowercase && !finalPassword.match(/[a-z]/)) {
      finalPassword =
        finalPassword.slice(0, 1) +
        lowercaseChars.charAt(randomInt(lowercaseChars.length)) +
        finalPassword.slice(2);
    }
    if (includeNumbers && !finalPassword.match(/[0-9]/)) {
      finalPassword =
        finalPassword.slice(0, 2) +
        numberChars.charAt(randomInt(numberChars.length)) +
        finalPassword.slice(3);
    }
    if (includeSpecialChars && !finalPassword.match(/[!@#$%^&*()_+~`|}{[\]:;?><,./-=]/)) {
      finalPassword =
        finalPassword.slice(0, 3) +
        specialChars.charAt(randomInt(specialChars.length)) +
        finalPassword.slice(4);
    }

    return finalPassword;
  }

  /**
   * Alias for generateSecurePassword to preserve compatibility with existing code
   */
  static generatePassword(
    length: number = 16,
    options: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSymbols?: boolean;
      excludeSimilarCharacters?: boolean;
    } = {},
  ): string {
    const {
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
    } = options;

    return this.generateSecurePassword(
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
    );
  }
}

export default CryptoServiceMock;
