/* eslint-disable @typescript-eslint/no-require-imports */

function isExpoGoWith(constants: unknown): boolean {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: constants }));

  let result = false;
  jest.isolateModules(() => {
    result = (require('../../utils/env') as typeof import('../../utils/env')).isExpoGo();
  });
  return result;
}

describe('isExpoGo', () => {
  it('detects Expo Go from the store client execution environment', () => {
    expect(isExpoGoWith({ executionEnvironment: 'storeClient' })).toBe(true);
  });

  it('detects Expo Go from the legacy app ownership flag', () => {
    expect(isExpoGoWith({ executionEnvironment: 'bare', appOwnership: 'expo' })).toBe(true);
  });

  it('does not treat the embedded standalone manifest as Expo Go', () => {
    // expo-constants resolves expoGoConfig to the embedded update manifest in standalone
    // builds (the manifest has no metadata key), so it must not be used as a signal.
    expect(
      isExpoGoWith({
        executionEnvironment: 'bare',
        appOwnership: null,
        expoGoConfig: { id: 'embedded-update', commitTime: 1, assets: [] },
        manifest: { id: 'embedded-update', commitTime: 1, assets: [] },
      }),
    ).toBe(false);
  });

  it('does not treat a standalone build as Expo Go', () => {
    expect(isExpoGoWith({ executionEnvironment: 'standalone' })).toBe(false);
  });

  it('returns false when the constants module throws', () => {
    const throwingConstants = {
      get executionEnvironment(): string {
        throw new Error('native constants unavailable');
      },
    };

    expect(isExpoGoWith(throwingConstants)).toBe(false);
  });
});
