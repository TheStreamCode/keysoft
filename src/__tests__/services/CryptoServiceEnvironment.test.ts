/* eslint-disable @typescript-eslint/no-require-imports */

function loadCryptoService(
  constants: unknown,
): typeof import('../../services/crypto/cryptoService') {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: constants }));

  let service: typeof import('../../services/crypto/cryptoService') | undefined;
  jest.isolateModules(() => {
    service = require('../../services/crypto/cryptoService');
  });
  return service as typeof import('../../services/crypto/cryptoService');
}

describe('CryptoService KDF selection', () => {
  it('loads the native Argon2 KDF in a production-like standalone build', () => {
    jest.doMock('react-native-argon2', () => ({
      __esModule: true,
      default: jest.fn(async () => ({ rawHash: 'ab'.repeat(32) })),
    }));

    const cryptoService = loadCryptoService({
      executionEnvironment: 'bare',
      appOwnership: null,
      expoGoConfig: { id: 'embedded-update', commitTime: 1, assets: [] },
      manifest: { id: 'embedded-update', commitTime: 1, assets: [] },
    });

    expect(cryptoService.isNativeKdfAvailable()).toBe(true);
  });

  it('keeps the PBKDF2 fallback only for Expo Go', () => {
    const argon2 = jest.fn(async () => ({ rawHash: 'ab'.repeat(32) }));
    jest.doMock('react-native-argon2', () => ({ __esModule: true, default: argon2 }));

    const cryptoService = loadCryptoService({ executionEnvironment: 'storeClient' });

    expect(cryptoService.isNativeKdfAvailable()).toBe(false);
    expect(argon2).not.toHaveBeenCalled();
  });
});
