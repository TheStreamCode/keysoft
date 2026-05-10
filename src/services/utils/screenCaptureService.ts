import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';
import Logger from '../../utils/logger';

/**
 * Service for managing screenshot protection.
 */
export class ScreenCaptureService {
  private static screenshotListeners: { [key: string]: { remove: () => void } } = {};

  /**
   * Prevents screenshot capture.
   * @returns A Promise that resolves when protection has been enabled.
   */
  static async preventScreenCapture(): Promise<void> {
    try {
      if (Platform.OS === 'web') return; // No-op on web
      await ScreenCapture.preventScreenCaptureAsync();
    } catch (error) {
      Logger.error('Failed to enable screenshot protection:', error);
    }
  }

  /**
   * Allows screenshot capture.
   * @returns A Promise that resolves when protection has been disabled.
   */
  static async allowScreenCapture(): Promise<void> {
    try {
      if (Platform.OS === 'web') return; // No-op on web
      await ScreenCapture.allowScreenCaptureAsync();
    } catch (error) {
      Logger.error('Failed to disable screenshot protection:', error);
    }
  }

  /**
   * Adds a screenshot listener.
   * @param identifier A unique identifier for the listener.
   * @param callback Function to call when a screenshot is captured.
   */
  static addScreenshotListener(identifier: string, callback: () => void): void {
    try {
      if (Platform.OS === 'web') return; // No-op on web
      // Remove any existing listener with the same identifier
      this.removeScreenshotListener(identifier);

      // Add the new listener
      this.screenshotListeners[identifier] = ScreenCapture.addScreenshotListener(callback);
    } catch (error) {
      Logger.error('Failed to add screenshot listener:', error);
    }
  }

  /**
   * Removes a screenshot listener.
   * @param identifier The identifier of the listener to remove.
   */
  static removeScreenshotListener(identifier: string): void {
    try {
      if (Platform.OS === 'web') return; // No-op on web
      if (this.screenshotListeners[identifier]) {
        this.screenshotListeners[identifier].remove();
        delete this.screenshotListeners[identifier];
      }
    } catch (error) {
      Logger.error('Failed to remove screenshot listener:', error);
    }
  }

  /**
   * Removes all screenshot listeners.
   */
  static removeAllScreenshotListeners(): void {
    try {
      if (Platform.OS === 'web') return; // No-op on web
      Object.keys(this.screenshotListeners).forEach((identifier) => {
        this.removeScreenshotListener(identifier);
      });
    } catch (error) {
      Logger.error('Failed to remove all screenshot listeners:', error);
    }
  }
}

export default ScreenCaptureService;
