import * as CryptoService from '../../services/crypto/cryptoService';
import * as CryptoJS from 'crypto-js';

// Mock dependencies
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length) => {
    // Return deterministic bytes for testing
    const arr = new Uint8Array(length);
    for (let i = 0; i < length; i++) arr[i] = i % 255;
    return arr;
  }),
}));

describe('CryptoService', () => {
  const password = 'test-password';
  const salt = 'test-salt';

  describe('generateSalt', () => {
    it('should generate a valid salt string', () => {
      const salt = CryptoService.generateSalt();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
    });
  });

  describe('deriveKey', () => {
    it('should derive a key using PBKDF2 when stored metadata explicitly uses PBKDF2', async () => {
      // Force PBKDF2 by setting memory to 0
      const key = await CryptoService.deriveKey(password, salt, 1000, 0);
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);

      // Verify consistency
      const key2 = await CryptoService.deriveKey(password, salt, 1000, 0);
      expect(key).toBe(key2);
    });

    it('should not fall back to PBKDF2 when stored metadata requires Argon2', async () => {
      jest.resetModules();
      jest.doMock('react-native-argon2', () => {
        throw new Error('native module unavailable');
      });
      /* eslint-disable @typescript-eslint/no-require-imports */
      const isolatedCryptoService =
        require('../../services/crypto/cryptoService') as typeof CryptoService;
      /* eslint-enable @typescript-eslint/no-require-imports */

      await expect(isolatedCryptoService.deriveKey(password, salt, 3, 65536)).rejects.toMatchObject(
        {
          name: 'KdfError',
          code: 'ARGON2_UNAVAILABLE',
        },
      );
    });
  });

  describe('Encryption/Decryption', () => {
    // Use a valid 256-bit Hex key (64 characters)
    const masterKey = '000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f';
    const plainText = 'sensitive-data';

    it('should encrypt and decrypt data correctly', async () => {
      const encrypted = await CryptoService.encrypt(plainText, masterKey);
      expect(encrypted).not.toBe(plainText);
      expect(typeof encrypted).toBe('string');

      const decrypted = await CryptoService.decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plainText);
    });

    it('should fail to decrypt with wrong key', async () => {
      const encrypted = await CryptoService.encrypt(plainText, masterKey);
      const wrongKey = 'wrong-key';

      // Decrypt now throws explicitly instead of returning '' on failure
      await expect(CryptoService.decrypt(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should throw CryptoError when MAC verification fails', async () => {
      const encrypted = await CryptoService.encrypt(plainText, masterKey);
      // Tamper with the ciphertext: replace last char to break MAC
      const tampered = encrypted.slice(0, -2) + 'AA';
      const validHexKey = '111213141516171819' + masterKey.slice(18);

      await expect(CryptoService.decrypt(tampered, validHexKey)).rejects.toThrow(
        CryptoService.CryptoError,
      );
    });

    it('should return empty string for empty input (legitimate empty case)', async () => {
      const result = await CryptoService.decrypt('', masterKey);
      expect(result).toBe('');
    });
  });

  describe('Password-encrypted backup payloads', () => {
    const plainText = JSON.stringify({
      passwords: [{ title: 'Email', username: 'user', password: 'secret' }],
    });
    const backupPassword = 'export-passphrase';

    it('should encrypt backup data with KDF metadata instead of using the raw password as a KS1 key', async () => {
      const encryptedPayload = await CryptoService.encryptWithPassword(plainText, backupPassword);
      const parsed = JSON.parse(encryptedPayload);

      expect(parsed.version).toBe('KS1-PW1');
      expect(parsed.kdf).toEqual(
        expect.objectContaining({
          salt: expect.any(String),
          iterations: expect.any(Number),
          memory: expect.any(Number),
        }),
      );
      expect(parsed.data).toEqual(expect.stringMatching(/^KS1:/));
      expect(encryptedPayload).not.toContain('secret');
      expect(encryptedPayload).not.toContain(backupPassword);
    });

    it('should decrypt backup data only with the correct password', async () => {
      const encryptedPayload = await CryptoService.encryptWithPassword(plainText, backupPassword);

      await expect(
        CryptoService.decryptWithPassword(encryptedPayload, backupPassword),
      ).resolves.toBe(plainText);
      await expect(
        CryptoService.decryptWithPassword(encryptedPayload, 'wrong-passphrase'),
      ).rejects.toThrow('Invalid backup password or payload');
    });
  });

  describe('createMasterKeyInfo', () => {
    it('should create master key info with salt and verifier', async () => {
      const info = await CryptoService.createMasterKeyInfo(password);

      expect(info).toHaveProperty('salt');
      expect(info).toHaveProperty('verifier');
      expect(info).toHaveProperty('iterations');

      // Verify we can verify the password
      const derivedKey = await CryptoService.deriveKey(
        password,
        info.salt,
        info.iterations,
        info.memory,
      );
      const verifier = CryptoJS.SHA256(derivedKey).toString();
      expect(verifier).toBe(info.verifier);
    });
  });
});
