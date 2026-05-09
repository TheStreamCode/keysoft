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
   * @param data Optional data to log
   */
  static debug(message: string, ...data: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...data);
    }
  }

  /**
   * Log an info message (only in development)
   * @param message The message to log
   * @param data Optional data to log
   */
  static info(message: string, ...data: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...data);
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to log
   */
  static warn(message: string, ...data: any[]): void {
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
  static error(message: string, error?: any, ...data: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      if (error) {
        console.error(`[ERROR] ${message}`, error, ...data);
      } else {
        console.error(`[ERROR] ${message}`, ...data);
      }
    }
  }

  /**
   * SECURITY WARNING: Never use this for sensitive data!
   * Only for non-sensitive debugging in development.
   * This method is completely disabled in production.
   *
   * @param label Label for the data
   * @param data Data to log (will be stringified)
   */
  static debugData(label: string, data: any): void {
    if (__DEV__ && this.currentLevel <= LogLevel.DEBUG) {
      try {
        console.log(`[DEBUG DATA] ${label}:`, JSON.stringify(data, null, 2));
      } catch (_e) {
        console.log(`[DEBUG DATA] ${label}: [Cannot stringify]`);
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
