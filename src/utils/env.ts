import Constants from 'expo-constants';

/**
 * Utilities per determinare l'ambiente di esecuzione (Expo Go vs Standalone/Dev Client).
 *
 * Do not use `Constants.expoGoConfig` as an Expo Go signal. expo-constants resolves that
 * property from the running manifest: in standalone/EAS builds the embedded update manifest
 * has no `metadata` key, so the getter returns the embedded manifest object and the check
 * becomes truthy outside Expo Go as well. That false positive made production builds take
 * the pure-JS PBKDF2 fallback instead of the native Argon2id KDF. `executionEnvironment`
 * and the deprecated `appOwnership` flag are the reliable signals.
 */
export function isExpoGo(): boolean {
  try {
    const execEnv: string | undefined = (Constants as any)?.executionEnvironment;
    const appOwnership: string | undefined = (Constants as any)?.appOwnership;
    return execEnv === 'storeClient' || appOwnership === 'expo';
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  try {
    const execEnv: string | undefined = (Constants as any)?.executionEnvironment;
    return execEnv === 'standalone';
  } catch {
    return false;
  }
}

export function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

export function envLabel(): string {
  if (isExpoGo()) return 'expo-go';
  if (isStandalone()) return 'standalone';
  return isDev() ? 'dev' : 'bare';
}

export default { isExpoGo, isStandalone, isDev, envLabel };
