import { getRandomBytes, bytesToHex, bytesToBase64, randomInt } from '../../utils/cryptoRandom';

// Mock expo-crypto with real randomness for these tests
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length: number) => {
    // Generate pseudo-random bytes for testing (not cryptographically secure, but deterministic)
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = (i * 37 + 42) % 256;
    }
    return bytes;
  }),
}));

describe('CryptoRandom', () => {
  describe('getRandomBytes', () => {
    it('should return a Uint8Array of the specified length', () => {
      const bytes = getRandomBytes(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
    });

    it('should return correct length for 32 bytes', () => {
      const bytes = getRandomBytes(32);
      expect(bytes.length).toBe(32);
    });

    it('should return correct length for 1 byte', () => {
      const bytes = getRandomBytes(1);
      expect(bytes.length).toBe(1);
    });

    it('should throw for zero length', () => {
      expect(() => getRandomBytes(0)).toThrow('length must be a positive number');
    });

    it('should throw for negative length', () => {
      expect(() => getRandomBytes(-5)).toThrow('length must be a positive number');
    });

    it('should throw for NaN length', () => {
      expect(() => getRandomBytes(NaN)).toThrow('length must be a positive number');
    });

    it('should throw for Infinity length', () => {
      expect(() => getRandomBytes(Infinity)).toThrow('length must be a positive number');
    });
  });

  describe('bytesToHex', () => {
    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([0xff, 0x00, 0xab]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('ff00ab');
    });

    it('should handle empty bytes', () => {
      const bytes = new Uint8Array([]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('');
    });

    it('should produce consistent output for same input', () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      expect(bytesToHex(bytes)).toBe(bytesToHex(bytes));
    });
  });

  describe('bytesToBase64', () => {
    it('should convert bytes to base64 string', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const base64 = bytesToBase64(bytes);
      expect(base64).toBe('SGVsbG8=');
    });

    it('should handle empty bytes', () => {
      const bytes = new Uint8Array([]);
      const base64 = bytesToBase64(bytes);
      expect(base64).toBe('');
    });
  });

  describe('randomInt', () => {
    it('should return a number less than maxExclusive', () => {
      const result = randomInt(10);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(10);
    });

    it('should return 0 for maxExclusive of 1', () => {
      const result = randomInt(1);
      expect(result).toBe(0);
    });

    it('should throw for zero maxExclusive', () => {
      expect(() => randomInt(0)).toThrow('maxExclusive must be a positive number');
    });

    it('should throw for negative maxExclusive', () => {
      expect(() => randomInt(-1)).toThrow('maxExclusive must be a positive number');
    });

    it('should throw for NaN maxExclusive', () => {
      expect(() => randomInt(NaN)).toThrow('maxExclusive must be a positive number');
    });

    it('should return values in range for larger maxExclusive', () => {
      for (let i = 0; i < 10; i++) {
        const result = randomInt(100);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(100);
      }
    });
  });
});
