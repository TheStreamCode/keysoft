import Constants from 'expo-constants';

/**
 * Utilities per determinare l'ambiente di esecuzione (Expo Go vs Standalone/Dev Client)
 * Basato su Constants.executionEnvironment e presenza di expoGoConfig.
 */
export function isExpoGo(): boolean {
  try {
    // StoreClient indica Expo Go
    // Alcune versioni mantengono anche appOwnership==='expo' (deprecato)
    const execEnv: any = (Constants as any)?.executionEnvironment;
    const expoGoConfig = (Constants as any)?.expoGoConfig;
    const appOwnership = (Constants as any)?.appOwnership;
    return execEnv === 'storeClient' || !!expoGoConfig || appOwnership === 'expo';
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  try {
    const execEnv: any = (Constants as any)?.executionEnvironment;
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
