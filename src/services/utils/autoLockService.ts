import { AppState, Platform } from 'react-native';
import { Storage } from '../index';
import NotificationService from './notificationService';
import * as Notifications from 'expo-notifications';
import Logger from '../../utils/logger';

/**
 * Service that manages automatic app lock after a period of inactivity.
 * Monitors when the app enters the background and locks it if it stays there
 * after a period longer than the configured timeout.
 */
class AutoLockService {
  private static instance: AutoLockService;
  private backgroundTime: number | null = null;
  private autoLockTimeout: number = 60; // in secondi (1 minuto)
  private lockCallback: (() => void) | null = null;
  private appStateSubscription: any = null;
  private warningNotificationId: string | null = null;
  private warningThreshold: number = 15; // Avvisa 15 secondi prima del blocco

  private constructor() {
    this.initialize();
  }

  static getInstance(): AutoLockService {
    if (!AutoLockService.instance) {
      AutoLockService.instance = new AutoLockService();
    }
    return AutoLockService.instance;
  }

  /**
   * Initializes the service by loading user preferences
   * and configuring the listener for app-state changes.
   */
  private async initialize() {
    try {
      Logger.debug('AutoLockService: Inizializzazione...');
      const preferences = await Storage.getUserPreferences();
      this.autoLockTimeout = preferences?.autoLockTimeout || 0;
      Logger.debug(`AutoLockService: Timeout impostato a ${this.autoLockTimeout} secondi`);

      // Initialize the notification service
      await NotificationService.initialize();

      // Configure the listener for app-state changes
      this.setupAppStateListener();
    } catch (error) {
      Logger.error("Errore durante l'inizializzazione di AutoLockService:", error);
    }
  }

  /**
   * Configures the listener for app-state changes.
   */
  private setupAppStateListener() {
    // Remove any previous listeners
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    // Add the new listener
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    Logger.debug('AutoLockService: Listener per AppState configurato');
  }

  /**
   * Handles app state changes.
   * @param nextAppState The new app state
   */
  private handleAppStateChange = (nextAppState: any) => {
    Logger.debug(`AutoLockService: Cambio stato app a ${nextAppState}`);

    if (nextAppState === 'active') {
      // The app returned to the foreground
      this.checkLockTimeout();

      // Clear any warning notifications
      this.cancelWarningNotification();
    } else if (nextAppState === 'background') {
      // The app entered the background
      this.backgroundTime = Date.now();
      Logger.debug(`AutoLockService: App in background, timestamp: ${this.backgroundTime}`);

      // Completely remove warning notification scheduling
      // Do not call scheduleWarningNotification anymore
    }
  };

  /**
   * Schedules a warning notification before auto-lock.
   */
  private async scheduleWarningNotification() {
    // Disable warning notifications for auto-lock
    Logger.debug('AutoLockService: Notifiche di avviso per il blocco automatico disabilitate');
    return;
  }

  /**
   * Clears the warning notification if present.
   */
  private cancelWarningNotification() {
    // Cancel the specific notification when its ID is available
    if (this.warningNotificationId) {
      NotificationService.cancelNotification(this.warningNotificationId);
      this.warningNotificationId = null;
      Logger.debug('AutoLockService: Notifica di avviso cancellata');
    }

    // Per sicurezza, cancelliamo anche tutte le notifiche programmate
    // This should prevent persistent notifications
    if (Platform.OS !== 'web') {
      Notifications.cancelAllScheduledNotificationsAsync()
        .then(() =>
          Logger.debug('AutoLockService: Tutte le notifiche programmate sono state cancellate'),
        )
        .catch((error) =>
          Logger.error(
            'AutoLockService: Errore durante la cancellazione delle notifiche programmate:',
            error,
          ),
        );
    }
  }

  /**
   * Checks whether the app should lock based on time spent in the background.
   */
  private checkLockTimeout() {
    // Auto-lock is disabled when the timeout is 0 or -1
    if (this.autoLockTimeout <= 0 || !this.backgroundTime) {
      Logger.debug(
        'AutoLockService: Blocco automatico disabilitato o nessun timestamp di background',
      );
      return;
    }

    const now = Date.now();
    const elapsedSeconds = (now - this.backgroundTime) / 1000;

    Logger.debug(
      `AutoLockService: Tempo trascorso in background: ${elapsedSeconds} secondi (limite: ${this.autoLockTimeout})`,
    );

    if (elapsedSeconds >= this.autoLockTimeout) {
      // The timeout elapsed, lock the app
      Logger.debug("AutoLockService: Timeout scaduto, blocco l'app");
      if (this.lockCallback) {
        this.lockCallback();
      } else {
        Logger.warn('AutoLockService: Nessun callback di blocco registrato');
      }
    }

    this.backgroundTime = null;
  }

  /**
   * Registers the callback invoked when the app must be locked.
   * @param callback La funzione da chiamare per bloccare l'app
   */
  setLockCallback(callback: () => void) {
    this.lockCallback = callback;
    Logger.debug('AutoLockService: Callback di blocco registrato');
  }

  /**
   * Updates the auto-lock timeout.
   * @param seconds The new timeout in seconds
   */
  updateTimeout(seconds: number) {
    Logger.debug(`AutoLockService: Aggiornamento timeout a ${seconds} secondi`);
    this.autoLockTimeout = seconds;

    // Remove warning notification scheduling
    // Do not call scheduleWarningNotification anymore, even when the app is in the background
  }

  /**
   * Sets the warning threshold before auto-lock.
   * @param seconds Number of seconds before lock when the warning should be sent
   */
  setWarningThreshold(seconds: number) {
    if (seconds > 0 && seconds < this.autoLockTimeout) {
      this.warningThreshold = seconds;
      Logger.debug(`AutoLockService: Soglia di avviso impostata a ${seconds} secondi`);
    }
  }

  /**
   * Disables the auto-lock service.
   */
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clear any warning notifications
    this.cancelWarningNotification();

    Logger.debug('AutoLockService: Servizio disattivato');
  }
}

export default AutoLockService.getInstance();
