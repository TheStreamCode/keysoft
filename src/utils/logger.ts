/**
 * Logger Service - Conditional logging based on environment
 *
 * Provides logging functionality that is automatically disabled in production builds.
 * Prevents sensitive data from being exposed in production logs.
 *
 * Usage:
 *   import Logger from '@/utils/logger';
 *
 *   Logger.debug('Debug message');
 *   Logger.info('Info message');
 *   Logger.warn('Warning message');
 *   Logger.error('Error message');
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class LoggerService {
  // In production, only log errors. In development, log everything.
  private static currentLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.ERROR;

  /**
   * Set the minimum log level to display
   * @param level The minimum log level
   */
  static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Log a debug message (only in development)
   * @param message The message to log
   * @param _data Ignored legacy context. Put only sanitized context in the message.
   */
  static debug(message: string, ..._data: unknown[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      // Debug objects can include preferences or vault records through upstream data flow.
      // Keep the sink message-only so callers cannot accidentally emit sensitive values.
      console.log(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log an info message (only in development)
   * @param message The message to log
   * @param data Optional data to log
   */
  static info(message: string, ...data: unknown[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...data);
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to log
   */
  static warn(message: string, ...data: unknown[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...data);
    }
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional error object
   * @param data Optional additional data
   */
  static error(message: string, error?: unknown, ...data: unknown[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      // Error objects may contain request data, file paths, or native-module details.
      // Keep production diagnostics intentionally message-only; development retains
      // the full context needed to debug locally.
      if (!__DEV__) {
        console.error(`[ERROR] ${message}`);
      } else if (error) {
        console.error(`[ERROR] ${message}`, error, ...data);
      } else {
        console.error(`[ERROR] ${message}`, ...data);
      }
    }
  }

  /**
   * Log a sensitive operation (sanitized - no actual data logged)
   * Use this for operations involving passwords, keys, etc.
   *
   * @param operation Description of the operation
   * @param success Whether the operation succeeded
   */
  static secureOperation(operation: string, success: boolean): void {
    if (__DEV__ && this.currentLevel <= LogLevel.INFO) {
      console.log(`[SECURE] ${operation}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  }
}

export default LoggerService;
export { LogLevel };
