import * as ExpoCrypto from 'expo-crypto';
import * as CryptoJS from 'crypto-js';
import Logger from './logger';

const MAX_UINT32 = 0x100000000;

export function getRandomBytes(length: number): Uint8Array {
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('getRandomBytes: length must be a positive number');
  }

  try {
    return ExpoCrypto.getRandomBytes(length);
  } catch (error) {
    const cryptoGlobal = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoGlobal?.getRandomValues) {
      const bytes = new Uint8Array(length);
      cryptoGlobal.getRandomValues(bytes);
      return bytes;
    }

    Logger.error('CryptoRandom: Secure RNG not available', error);
    throw new Error('Secure RNG not available');
  }
}

export function bytesToWordArray(bytes: Uint8Array) {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

export function bytesToHex(bytes: Uint8Array): string {
  return CryptoJS.enc.Hex.stringify(bytesToWordArray(bytes));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return CryptoJS.enc.Base64.stringify(bytesToWordArray(bytes));
}

export function randomInt(maxExclusive: number): number {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
    throw new Error('randomInt: maxExclusive must be a positive number');
  }

  const limit = Math.floor(MAX_UINT32 / maxExclusive) * maxExclusive;
  let value = 0;

  do {
    const bytes = getRandomBytes(4);
    value = ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
  } while (value >= limit);

  return value % maxExclusive;
}
