import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';
import Logger from '../../utils/logger';

/**
 * Servizio per la gestione della protezione degli screenshot.
 */
export class ScreenCaptureService {
  private static screenshotListeners: { [key: string]: { remove: () => void } } = {};

  /**
   * Previene la cattura di screenshot.
   * @returns A Promise that resolves when protection has been enabled.
   */
  static async preventScreenCapture(): Promise<void> {
    try {
      if (Platform.OS === 'web') return; // no-op su Web
      await ScreenCapture.preventScreenCaptureAsync();
    } catch (error) {
      Logger.error("Errore durante l'attivazione della protezione degli screenshot:", error);
    }
  }

  /**
   * Permette la cattura di screenshot.
   * @returns A Promise that resolves when protection has been disabled.
   */
  static async allowScreenCapture(): Promise<void> {
    try {
      if (Platform.OS === 'web') return; // no-op su Web
      await ScreenCapture.allowScreenCaptureAsync();
    } catch (error) {
      Logger.error('Errore durante la disattivazione della protezione degli screenshot:', error);
    }
  }

  /**
   * Adds a screenshot listener.
   * @param identifier A unique identifier for the listener.
   * @param callback Function to call when a screenshot is captured.
   */
  static addScreenshotListener(identifier: string, callback: () => void): void {
    try {
      if (Platform.OS === 'web') return; // no-op su Web
      // Remove any existing listener with the same identifier
      this.removeScreenshotListener(identifier);

      // Add the new listener
      this.screenshotListeners[identifier] = ScreenCapture.addScreenshotListener(callback);
    } catch (error) {
      Logger.error("Errore durante l'aggiunta del listener per gli screenshot:", error);
    }
  }

  /**
   * Removes a screenshot listener.
   * @param identifier The identifier of the listener to remove.
   */
  static removeScreenshotListener(identifier: string): void {
    try {
      if (Platform.OS === 'web') return; // no-op su Web
      if (this.screenshotListeners[identifier]) {
        this.screenshotListeners[identifier].remove();
        delete this.screenshotListeners[identifier];
      }
    } catch (error) {
      Logger.error('Errore durante la rimozione del listener per gli screenshot:', error);
    }
  }

  /**
   * Removes all screenshot listeners.
   */
  static removeAllScreenshotListeners(): void {
    try {
      if (Platform.OS === 'web') return; // no-op su Web
      Object.keys(this.screenshotListeners).forEach((identifier) => {
        this.removeScreenshotListener(identifier);
      });
    } catch (error) {
      Logger.error('Errore durante la rimozione di tutti i listener per gli screenshot:', error);
    }
  }
}

export default ScreenCaptureService;
