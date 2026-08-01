import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import NotificationService from './notificationService';
import Logger from '../../utils/logger';

/**
 * Service for clipboard management with an auto-clear timer.
 */
export class ClipboardService {
  private static timeoutIds: { [key: string]: ReturnType<typeof setTimeout> } = {};
  private static warningTimeoutIds: { [key: string]: ReturnType<typeof setTimeout> } = {};
  private static notificationIds: { [key: string]: string | null } = {};
  private static defaultTimeoutSeconds: number = 60; // 1 minuto
  private static warningThreshold: number = 15; // Avvisa 15 secondi prima della cancellazione

  /**
   * Initializes the notification service.
   */
  private static async initializeNotifications(): Promise<void> {
    await NotificationService.initialize();
  }

  /**
   * Copies text to the clipboard and schedules it to be cleared.
   * @param text The text to copy.
   * @param identifier A unique identifier for the timer (optional).
   * @param timeoutSeconds Seconds before the text is cleared from the clipboard.
   * @returns A Promise that resolves when the text has been copied.
   */
  static async copyToClipboard(
    text: string,
    identifier: string = 'default',
    timeoutSeconds: number = this.defaultTimeoutSeconds,
  ): Promise<void> {
    try {
      Logger.debug(
        `ClipboardService: Copia testo nella clipboard con timeout di ${timeoutSeconds} secondi`,
      );

      // Initialize the notification service when needed
      await this.initializeNotifications();

      // Clear any existing timer with the same identifier
      this.clearTimeout(identifier);

      // Copy the text to the clipboard.
      // NOTE: on Android 13+ the system shows a clipboard preview containing the
      // copied value. Suppressing it needs the ClipData "is sensitive" extra, which
      // the expo-clipboard version bundled with Expo SDK 57 does not expose through
      // `SetStringOptions`. See docs/security.md ("Known Limitations").
      await Clipboard.setStringAsync(text);

      // When the timeout is greater than the warning threshold, schedule a warning timer
      if (timeoutSeconds > this.warningThreshold) {
        // Disable clipboard-clear warning notifications
        Logger.debug(
          'ClipboardService: Notifiche di avviso per la cancellazione della clipboard disabilitate',
        );

        // The code below stays commented out while notifications are disabled
        /*
        const warningTime = timeoutSeconds - this.warningThreshold;

        this.warningTimeoutIds[identifier] = setTimeout(async () => {
          Logger.debug(`ClipboardService: Invio notifica di avviso per ${identifier}`);

          // Send a warning notification
          this.notificationIds[identifier] = await NotificationService.sendClipboardClearWarning(this.warningThreshold);

          delete this.warningTimeoutIds[identifier];
        }, warningTime * 1000);
        */
      }

      // Set a timer to clear clipboard text
      this.timeoutIds[identifier] = setTimeout(async () => {
        Logger.debug(`ClipboardService: Timeout scaduto per ${identifier}, cancello la clipboard`);

        // Clear any warning notifications
        if (this.notificationIds[identifier]) {
          await NotificationService.cancelNotification(this.notificationIds[identifier]!);
          delete this.notificationIds[identifier];
        }

        // On iOS, clipboard contents cannot be verified for privacy reasons
        // so clear only on Android or when we are sure the content has not changed
        if (Platform.OS === 'android') {
          const currentClipboard = await Clipboard.getStringAsync();
          if (currentClipboard === text) {
            await Clipboard.setStringAsync('');
            Logger.debug('ClipboardService: Clipboard cancellata (Android)');
          } else {
            Logger.debug('ClipboardService: Il contenuto della clipboard è cambiato, non cancello');
          }
        } else {
          // On iOS, clear anyway, although it may not be the content we set
          await Clipboard.setStringAsync('');
          Logger.debug('ClipboardService: Clipboard cancellata (iOS)');
        }

        delete this.timeoutIds[identifier];
      }, timeoutSeconds * 1000);
    } catch (error) {
      Logger.error('Errore durante la copia nella clipboard:', error);
      throw new Error('Impossibile copiare nella clipboard');
    }
  }

  /**
   * Copies text that is not a secret and leaves it on the clipboard.
   *
   * The auto-clear timer exists to bound the exposure of passwords; wiping something
   * like a support address a minute after the user asked for it would only destroy
   * their clipboard content (on iOS the timer clears blindly, because the clipboard
   * cannot be read back for comparison).
   * @param text The text to copy.
   * @returns A Promise that resolves when the text has been copied.
   */
  static async copyPlainText(text: string): Promise<void> {
    try {
      Logger.debug('ClipboardService: Copia testo non sensibile senza cancellazione automatica');

      // Overwriting the clipboard already removes whatever secret was on it, so the
      // pending timers have nothing left to clear: dropping them keeps this text from
      // being wiped when a previous password timeout expires.
      this.clearAllTimeouts();

      await Clipboard.setStringAsync(text);
    } catch (error) {
      Logger.error('Errore durante la copia nella clipboard:', error);
      throw new Error('Impossibile copiare nella clipboard');
    }
  }

  /**
   * Clears one auto-clear timer.
   * @param identifier The identifier of the timer to clear.
   */
  static clearTimeout(identifier: string = 'default'): void {
    // Clear the main timer
    if (this.timeoutIds[identifier]) {
      clearTimeout(this.timeoutIds[identifier]);
      delete this.timeoutIds[identifier];
      Logger.debug(`ClipboardService: Timer cancellato per ${identifier}`);
    }

    // Clear the warning timer
    if (this.warningTimeoutIds[identifier]) {
      clearTimeout(this.warningTimeoutIds[identifier]);
      delete this.warningTimeoutIds[identifier];
      Logger.debug(`ClipboardService: Timer di avviso cancellato per ${identifier}`);
    }

    // Clear any notifications
    if (this.notificationIds[identifier]) {
      NotificationService.cancelNotification(this.notificationIds[identifier]!);
      delete this.notificationIds[identifier];
      Logger.debug(`ClipboardService: Notifica cancellata per ${identifier}`);
    }
  }

  /**
   * Clears all auto-clear timers.
   */
  static clearAllTimeouts(): void {
    // Clear all main timers
    Object.keys(this.timeoutIds).forEach((identifier) => {
      clearTimeout(this.timeoutIds[identifier]);
      delete this.timeoutIds[identifier];
    });

    // Clear all warning timers
    Object.keys(this.warningTimeoutIds).forEach((identifier) => {
      clearTimeout(this.warningTimeoutIds[identifier]);
      delete this.warningTimeoutIds[identifier];
    });

    // Clear all notifications
    Object.keys(this.notificationIds).forEach((identifier) => {
      if (this.notificationIds[identifier]) {
        NotificationService.cancelNotification(this.notificationIds[identifier]!);
        delete this.notificationIds[identifier];
      }
    });

    Logger.debug('ClipboardService: Tutti i timer e le notifiche cancellati');
  }

  /**
   * Updates the default timeout for clearing the clipboard.
   * @param seconds The new timeout in seconds.
   */
  static updateDefaultTimeout(seconds: number): void {
    Logger.debug(`ClipboardService: Aggiornamento timeout predefinito a ${seconds} secondi`);
    this.defaultTimeoutSeconds = seconds;
  }

  /**
   * Sets the warning threshold before clipboard clearing.
   * @param seconds Seconds before clearing when the warning should be sent
   */
  static setWarningThreshold(seconds: number): void {
    if (seconds > 0 && seconds < this.defaultTimeoutSeconds) {
      this.warningThreshold = seconds;
      Logger.debug(`ClipboardService: Soglia di avviso impostata a ${seconds} secondi`);
    }
  }

  /**
   * Reads the current clipboard content.
   * @returns A Promise that resolves with the clipboard content.
   */
  static async readFromClipboard(): Promise<string> {
    try {
      return await Clipboard.getStringAsync();
    } catch (error) {
      Logger.error('Errore durante la lettura dalla clipboard:', error);
      throw new Error('Impossibile leggere dalla clipboard');
    }
  }
}

export default ClipboardService;
