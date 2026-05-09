/**
 * Wrappa una Promise con un timeout. Se la Promise originale non si risolve
 * within `ms` milliseconds, it is rejected with TimeoutError.
 *
 * Uso tipico: proteggere chiamate a SecureStore, KDF (Argon2/PBKDF2) o altre
 * operazioni asincrone che potrebbero bloccarsi indefinitamente.
 */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = <T>(promise: Promise<T>, ms: number, label?: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const message = label
        ? `Operation "${label}" timed out after ${ms}ms`
        : `Operation timed out after ${ms}ms`;
      reject(new TimeoutError(message));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

/** Default timeout for Argon2. Some Android release devices take more
 *  tempo con 64MB di memoria, quindi lasciamo margine senza blocchi indefiniti. */
export const KDF_TIMEOUT_MS = 60_000;

/** Timeout per operazioni SecureStore - dovrebbe essere veloce sulla quasi
 *  devices, but SecureStore can hang on devices
 *  with a corrupted keychain or restrictive system policies. */
export const SECURESTORE_TIMEOUT_MS = 10_000;
