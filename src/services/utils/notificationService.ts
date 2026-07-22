import { Platform } from 'react-native';
import type { Notification as ExpoNotification } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notification } from '../../components/NotificationBell';
import Logger from '../../utils/logger';
import { isExpoGo } from '../../utils/env';
import { Password } from '../../models/Password';
import { NotificationSettings } from '../../models/User';
import { analyzeVaultHealth } from '../vault-health/vaultHealthService';
import { bytesToHex, getRandomBytes } from '../../utils/cryptoRandom';

// AsyncStorage key for notifications
const NOTIFICATIONS_STORAGE_KEY = 'keysoft_notifications';
// Maximum number of notifications to keep
const MAX_NOTIFICATIONS = 50;

// Check intervals in milliseconds
const BACKUP_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 giorni tra un controllo e l'altro
const PASSWORD_CHECK_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 giorni tra un controllo e l'altro

// Warning thresholds
const BACKUP_WARNING_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 giorni senza backup
// const PASSWORD_EXPIRY_THRESHOLD = 180 * 24 * 60 * 60 * 1000; // 180 days before a password is considered old when it has no explicit expiration

// Loading the expo-notifications barrel in Expo Go on Android also initializes
// its remote-push token listener. Remote push is intentionally unavailable in
// Expo Go and SDK 57 throws during module evaluation, before React can mount.
// Keep Expo Go in local-history mode; native/EAS builds load the module lazily
// and retain full local-notification support.
const IS_WEB = Platform.OS === 'web';
const IS_EXPO_GO = isExpoGo();
const IS_LOCAL_HISTORY_ONLY = IS_WEB || IS_EXPO_GO;

type ExpoNotificationsModule = typeof import('expo-notifications');

declare const require: (moduleName: string) => unknown;

let notificationsModule: ExpoNotificationsModule | null | undefined;

function getNativeNotifications(): ExpoNotificationsModule | null {
  if (IS_LOCAL_HISTORY_ONLY) return null;

  if (notificationsModule === undefined) {
    notificationsModule = require('expo-notifications') as ExpoNotificationsModule;
  }

  return notificationsModule;
}

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

function createNotificationNonce(): string {
  return bytesToHex(getRandomBytes(8));
}

function createNotificationId(type: NotificationType, suffix?: string): string {
  const suffixPart = suffix ? `${suffix}_` : '';
  return `${type}_${suffixPart}${Date.now()}_${createNotificationNonce()}`;
}

function createUniqueTimestamp(): string {
  return `${Date.now()}_${createNotificationNonce()}`;
}

/**
 * Supported notification types
 */
export enum NotificationType {
  // Security notifications
  PASSWORD_EXPIRY = 'password_expiry',
  WEAK_PASSWORD = 'weak_password',
  DUPLICATE_PASSWORD = 'duplicate_password',

  // Timeout notifications
  AUTO_LOCK_WARNING = 'auto_lock_warning',
  CLIPBOARD_CLEAR_WARNING = 'clipboard_clear_warning',

  // Authentication notifications
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',

  // Backup notifications
  BACKUP_REMINDER = 'backup_reminder',
  BACKUP_SUCCESS = 'backup_success',
}

/**
 * Notification management service
 */
class NotificationService {
  private static instance: NotificationService;
  private isInitialized: boolean = false;
  private notificationSettings: Record<NotificationType, boolean> = {
    [NotificationType.PASSWORD_EXPIRY]: true,
    [NotificationType.WEAK_PASSWORD]: true,
    [NotificationType.DUPLICATE_PASSWORD]: true,
    [NotificationType.AUTO_LOCK_WARNING]: true,
    [NotificationType.CLIPBOARD_CLEAR_WARNING]: true,
    [NotificationType.LOGIN_SUCCESS]: true,
    [NotificationType.LOGIN_FAILURE]: true,
    [NotificationType.BACKUP_REMINDER]: true,
    [NotificationType.BACKUP_SUCCESS]: true,
  };
  private notificationListeners: ((notification: Notification) => void)[] = [];
  private translate: TranslationFn = () => '';

  setTranslator(translator: TranslationFn): void {
    this.translate = translator;
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
  }

  /**
   * Initializes the notification service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    const notifications = getNativeNotifications();

    if (!notifications) {
      // Web and Expo Go keep the in-app notification history without loading
      // remote-push APIs that are unavailable in the Expo Go Android client.
      this.isInitialized = true;
      Logger.debug(
        `NotificationService (${IS_EXPO_GO ? 'expo-go' : 'web'}): using local history only`,
      );
      return true;
    }

    try {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      // Cancel all scheduled notifications at startup
      await notifications.cancelAllScheduledNotificationsAsync();
      Logger.debug(
        "NotificationService: Tutte le notifiche programmate sono state cancellate all'avvio",
      );

      // Request notification permissions
      const { status: existingStatus } = await notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Logger.debug('Permessi per le notifiche non concessi!');
        return false;
      }

      // Configure notifications for the current platform
      if (Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4B86B4',
        });
      }

      // Configure the incoming notification listener
      notifications.addNotificationReceivedListener(this.handleNotificationReceived);

      this.isInitialized = true;
      Logger.debug('Servizio di notifiche inizializzato con successo');
      return true;
    } catch (error) {
      Logger.error("Errore durante l'inizializzazione del servizio di notifiche:", error);
      return false;
    }
  }

  /**
   * Handles an incoming notification
   */
  private handleNotificationReceived = async (event: ExpoNotification) => {
    if (IS_LOCAL_HISTORY_ONLY) return;

    try {
      const { request } = event;
      const { content } = request;
      const { title, body, data } = content;

      if (!title || !body || !data || !data.type) {
        Logger.debug('Notifica ricevuta con dati incompleti, ignoro');
        return;
      }

      const type = data.type as NotificationType;
      const notification: Notification = {
        id: request.identifier,
        title,
        body,
        type,
        timestamp: Date.now(),
        read: false,
        data: { ...data },
      };

      // Save the notification
      await this.saveNotification(notification);

      // Notify listeners
      this.notifyListeners(notification);

      Logger.debug(`Notifica ricevuta e salvata: ${title}`);
    } catch (error) {
      Logger.error('Errore durante la gestione della notifica ricevuta:', error);
    }
  };

  /**
   * Saves a notification to local storage
   */
  private async saveNotification(notification: Notification): Promise<void> {
    try {
      // Load existing notifications
      const notifications = await this.getRecentNotifications();

      // Check for an existing notification with the same ID or similar content in the last 5 seconds
      const currentTime = Date.now();
      const recentTimeThreshold = 5000; // 5 secondi

      const isDuplicate = notifications.some(
        (n) =>
          // Same notification with the same ID
          n.id === notification.id ||
          // Similar notification with the same type, title, and body sent in the last 5 seconds
          (n.type === notification.type &&
            n.title === notification.title &&
            n.body === notification.body &&
            currentTime - n.timestamp < recentTimeThreshold),
      );

      // Ignore duplicate notifications
      if (isDuplicate) {
        Logger.debug(`Notifica duplicata ignorata: ${notification.title}`);
        return;
      }

      // Always generate a unique ID to avoid duplicates
      notification.id = createNotificationId(notification.type);

      // Add the new notification at the start of the array
      notifications.unshift(notification);

      // Limit the number of notifications
      const limitedNotifications = notifications.slice(0, MAX_NOTIFICATIONS);

      // Save notifications
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(limitedNotifications));
      Logger.debug(`Notifica salvata con successo: ${notification.title} (ID: ${notification.id})`);
    } catch (error) {
      Logger.error('Errore durante il salvataggio della notifica:', error);
    }
  }

  /**
   * Notifies registered listeners
   */
  private notifyListeners(notification: Notification): void {
    this.notificationListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        Logger.error('Errore durante la notifica di un listener:', error);
      }
    });
  }

  /**
   * Updates notification settings
   * @param settings The new settings
   */
  updateSettings(settings: NotificationSettings): void {
    // Copy the settings
    const updatedSettings = { ...this.notificationSettings };

    // Update settings
    Object.keys(settings).forEach((key) => {
      const typedKey = key as NotificationType;
      const settingValue = settings[typedKey];
      if (settingValue !== undefined) {
        updatedSettings[typedKey] = settingValue;
      }
    });

    this.notificationSettings = updatedSettings;
    Logger.debug('Impostazioni notifiche aggiornate:', this.notificationSettings);
  }

  /**
   * Checks whether a notification type is enabled
   * @param type The notification type
   * @returns True when the notification is enabled, otherwise false
   */
  isNotificationEnabled(type: NotificationType): boolean {
    return this.notificationSettings[type] === true;
  }

  /**
   * Sends a notification
   * @param title The notification title
   * @param body The notification body
   * @param type The notification type
   * @param data Additional data attached to the notification
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendNotification(
    title: string,
    body: string,
    type: NotificationType,
    data?: any,
  ): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check whether this notification type is enabled
    if (!this.isNotificationEnabled(type)) {
      Logger.debug(`Notifica di tipo ${type} disabilitata, non verrà inviata`);
      return null;
    }

    try {
      const uniqueData = { type, ...data, _uniqueTimestamp: createUniqueTimestamp() };

      const notifications = getNativeNotifications();

      if (!notifications) {
        // Simulate immediate notification by storing locally and notifying listeners
        const notification: Notification = {
          id: createNotificationId(type),
          title,
          body,
          type,
          timestamp: Date.now(),
          read: false,
          data: uniqueData,
        };
        await this.saveNotification(notification);
        this.notifyListeners(notification);
        Logger.debug('NotificationService (web): simulated notification saved');
        return notification.id;
      }

      const notificationId = await notifications.scheduleNotificationAsync({
        content: { title, body, data: uniqueData },
        trigger: null,
      });

      Logger.debug(`Notifica inviata con ID: ${notificationId}`);

      // Also create and store the notification locally
      const notification: Notification = {
        id: notificationId,
        title,
        body,
        type,
        timestamp: Date.now(),
        read: false,
        data: uniqueData,
      };

      await this.saveNotification(notification);

      // Notify listeners
      this.notifyListeners(notification);

      return notificationId;
    } catch (error) {
      Logger.error("Errore durante l'invio della notifica:", error);
      return null;
    }
  }

  /**
   * Schedules a notification to be shown after a delay
   * @param title The notification title
   * @param body The notification body
   * @param type The notification type
   * @param seconds Number of seconds before showing the notification
   * @param data Additional data attached to the notification
   * @returns The notification ID, or null when the notification was not scheduled
   */
  async scheduleNotification(
    title: string,
    body: string,
    type: NotificationType,
    seconds: number,
    data?: any,
  ): Promise<string | null> {
    // Explicitly block auto-lock and clipboard-timeout notifications
    if (
      type === NotificationType.AUTO_LOCK_WARNING ||
      type === NotificationType.CLIPBOARD_CLEAR_WARNING
    )
      return null;
    if (!this.isInitialized) await this.initialize();
    if (!this.isNotificationEnabled(type)) return null;

    try {
      const uniqueData = { type, ...data, _uniqueTimestamp: createUniqueTimestamp() };

      const notifications = getNativeNotifications();

      if (!notifications) {
        // On web, don't actually schedule; just store a record indicating a scheduled intent
        const notification: Notification = {
          id: createNotificationId(type, 'scheduled'),
          title,
          body,
          type,
          timestamp: Date.now() + seconds * 1000,
          read: false,
          data: uniqueData,
        };
        await this.saveNotification(notification);
        Logger.debug('NotificationService (web): simulated scheduled notification');
        return notification.id;
      }

      // Check whether notifications of the same type are already scheduled
      const scheduledNotifications = await notifications.getAllScheduledNotificationsAsync();
      const similarNotifications = scheduledNotifications.filter(
        (n) =>
          n.content.data &&
          typeof n.content.data === 'object' &&
          'type' in n.content.data &&
          n.content.data.type === type &&
          n.content.title === title &&
          n.content.body === body,
      );

      // Do not schedule a new notification when a similar one is already scheduled
      if (similarNotifications.length > 0) {
        Logger.debug(
          `Notifica simile già programmata di tipo ${type}, non verrà programmata una nuova notifica`,
        );
        return null;
      }

      const notificationId = await notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: uniqueData,
        },
        trigger: {
          seconds: seconds,
          type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });

      Logger.debug(`Notifica programmata con ID: ${notificationId} per ${seconds} secondi da ora`);
      return notificationId;
    } catch (error) {
      Logger.error('Errore durante la programmazione della notifica:', error);
      return null;
    }
  }

  /**
   * Cancels a notification
   * @param notificationId The notification ID to cancel
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      const notifications = getNativeNotifications();

      if (!notifications) {
        // Remove from local history only; no native cancel
        const notifications = await this.getRecentNotifications();
        const updated = notifications.filter((n) => n.id !== notificationId);
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
        Logger.debug(`NotificationService (web): simulated cancel for ${notificationId}`);
        return;
      }
      await notifications.cancelScheduledNotificationAsync(notificationId);
      Logger.debug(`Notifica con ID: ${notificationId} cancellata`);
    } catch (error) {
      Logger.error('Errore durante la cancellazione della notifica:', error);
    }
  }

  /**
   * Cancels all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const notifications = getNativeNotifications();

      if (!notifications) {
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
        Logger.debug('NotificationService (web): cleared local notifications');
        return;
      }
      await notifications.cancelAllScheduledNotificationsAsync();
      Logger.debug('Tutte le notifiche cancellate');
    } catch (error) {
      Logger.error('Errore durante la cancellazione di tutte le notifiche:', error);
    }
  }

  /**
   * Gets recent notifications
   * @returns An array of recent notifications
   */
  async getRecentNotifications(): Promise<Notification[]> {
    try {
      const notificationsJson = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!notificationsJson) {
        return [];
      }

      return JSON.parse(notificationsJson) as Notification[];
    } catch (error) {
      Logger.error('Errore durante il recupero delle notifiche recenti:', error);
      return [];
    }
  }

  /**
   * Marks one notification as read
   * @param id The notification ID to mark as read
   */
  async markNotificationAsRead(id: string): Promise<void> {
    try {
      const notifications = await this.getRecentNotifications();
      const updatedNotifications = notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );

      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
      Logger.debug(`Notifica con ID: ${id} segnata come letta`);
    } catch (error) {
      Logger.error('Errore durante la marcatura della notifica come letta:', error);
    }
  }

  /**
   * Marks all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      const notifications = await this.getRecentNotifications();
      const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));

      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
      Logger.debug('Tutte le notifiche segnate come lette');
    } catch (error) {
      Logger.error('Errore durante la marcatura di tutte le notifiche come lette:', error);
    }
  }

  /**
   * Deletes one notification
   * @param id The notification ID to delete
   */
  async deleteNotification(id: string): Promise<void> {
    try {
      const notifications = await this.getRecentNotifications();
      const updatedNotifications = notifications.filter((n) => n.id !== id);

      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
      Logger.debug(`Notifica con ID: ${id} eliminata`);
    } catch (error) {
      Logger.error("Errore durante l'eliminazione della notifica:", error);
    }
  }

  /**
   * Deletes all notifications
   */
  async deleteAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
      Logger.debug('Tutte le notifiche eliminate');
    } catch (error) {
      Logger.error("Errore durante l'eliminazione di tutte le notifiche:", error);
    }
  }

  /**
   * Registers a listener for incoming notifications
   * @param listener Function invoked when a notification is received
   * @returns An object with a remove method for unregistering the listener
   */
  addNotificationReceivedListener(listener: (notification: Notification) => void): {
    remove: () => void;
  } {
    this.notificationListeners.push(listener);

    return {
      remove: () => {
        const index = this.notificationListeners.indexOf(listener);
        if (index !== -1) {
          this.notificationListeners.splice(index, 1);
        }
      },
    };
  }

  /**
   * Sends an auto-lock warning notification
   * @param seconds Seconds remaining before lock
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendAutoLockWarning(_seconds: number): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_auto_lock_warning_title'),
      this.t('notification_auto_lock_warning_body'),
      NotificationType.AUTO_LOCK_WARNING,
    );
  }

  /**
   * Sends a clipboard-clear warning notification
   * @param seconds Seconds remaining before clearing
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendClipboardClearWarning(_seconds: number): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_clipboard_clear_warning_title'),
      this.t('notification_clipboard_clear_warning_body'),
      NotificationType.CLIPBOARD_CLEAR_WARNING,
    );
  }

  /**
   * Sends a weak-password warning notification
   * @param passwordTitle The password title
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendWeakPasswordWarning(_passwordTitle: string): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_weak_password_warning_title'),
      this.t('notification_weak_password_warning_body'),
      NotificationType.WEAK_PASSWORD,
    );
  }

  /**
   * Sends a duplicate-password warning notification
   * @param passwordTitle The password title
   * @param duplicateCount The number of duplicates
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendDuplicatePasswordWarning(
    _passwordTitle: string,
    duplicateCount: number,
  ): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_duplicate_password_warning_title'),
      this.t('notification_duplicate_password_warning_body', { duplicateCount }),
      NotificationType.DUPLICATE_PASSWORD,
      { duplicateCount },
    );
  }

  /**
   * Sends an expired-password warning notification
   * @param passwordTitle The password title
   * @param daysAgo Number of days since the password was last updated
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendPasswordExpiryWarning(_passwordTitle: string, daysAgo: number): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_password_expiry_warning_title'),
      this.t('notification_password_expiry_warning_body', { daysAgo }),
      NotificationType.PASSWORD_EXPIRY,
      { daysAgo },
    );
  }

  /**
   * Sends a backup reminder notification
   * @param daysAgo Days elapsed since the last backup
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendBackupReminder(daysAgo: number): Promise<string | null> {
    // When daysAgo is 0, the export has just been completed
    if (daysAgo === 0) {
      return this.sendNotification(
        this.t('notification_backup_export_completed_title'),
        this.t('notification_backup_export_completed_body'),
        NotificationType.BACKUP_REMINDER,
      );
    }

    // Otherwise, send a reminder
    return this.sendNotification(
      this.t('notification_backup_reminder_title'),
      this.t('notification_backup_reminder_body', { daysAgo }),
      NotificationType.BACKUP_REMINDER,
      { daysAgo },
    );
  }

  /**
   * Sends a backup confirmation notification
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendBackupSuccess(): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_backup_success_title'),
      this.t('notification_backup_success_body'),
      NotificationType.BACKUP_SUCCESS,
    );
  }

  /**
   * Sends a failed-login warning notification
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendLoginFailure(): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_login_failure_title'),
      this.t('notification_login_failure_body'),
      NotificationType.LOGIN_FAILURE,
    );
  }

  /**
   * Sends a successful-login confirmation notification
   * @returns The notification ID, or null when the notification was not sent
   */
  async sendLoginSuccess(): Promise<string | null> {
    return this.sendNotification(
      this.t('notification_login_success_title'),
      this.t('notification_login_success_body'),
      NotificationType.LOGIN_SUCCESS,
    );
  }

  /**
   * Gets the notification service instance
   * @returns The notification service instance
   */
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Checks whether periodic checks should run
   * @param passwords Password list
   * @param lastBackupTime Timestamp of the last backup
   * @param lastChecks Map of the last completed checks
   * @returns Updated map of the last completed checks
   */
  async checkPeriodicNotifications(
    passwords: Password[],
    lastBackupTime: number | undefined,
    lastChecks: { [key in NotificationType]?: number } = {},
  ): Promise<{ [key in NotificationType]?: number }> {
    const now = Date.now();
    const updatedChecks = { ...lastChecks };
    const health = analyzeVaultHealth(passwords, now);

    // 1. Backup check
    if (this.shouldRunCheck(lastChecks[NotificationType.BACKUP_REMINDER], BACKUP_CHECK_INTERVAL)) {
      if (lastBackupTime) {
        const daysSinceBackup = Math.floor((now - lastBackupTime) / (24 * 60 * 60 * 1000));
        if (now - lastBackupTime > BACKUP_WARNING_THRESHOLD) {
          await this.sendBackupReminder(daysSinceBackup);
        }
      }
      updatedChecks[NotificationType.BACKUP_REMINDER] = now;
    }

    // 2. Weak-password check
    if (this.shouldRunCheck(lastChecks[NotificationType.WEAK_PASSWORD], PASSWORD_CHECK_INTERVAL)) {
      if (health.weak > 0) {
        await this.sendNotification(
          this.t('notification_weak_password_warning_title'),
          this.t('notification_weak_password_summary_body', { weakCount: health.weak }),
          NotificationType.WEAK_PASSWORD,
        );
      }
      updatedChecks[NotificationType.WEAK_PASSWORD] = now;
    }

    // 3. Duplicate-password check
    if (
      this.shouldRunCheck(lastChecks[NotificationType.DUPLICATE_PASSWORD], PASSWORD_CHECK_INTERVAL)
    ) {
      if (health.reused > 0) {
        await this.sendNotification(
          this.t('notification_duplicate_password_warning_title'),
          this.t('notification_duplicate_password_summary_body', {
            duplicateCount: health.reused,
          }),
          NotificationType.DUPLICATE_PASSWORD,
        );
      }
      updatedChecks[NotificationType.DUPLICATE_PASSWORD] = now;
    }

    // 4. Expiration check
    if (
      this.shouldRunCheck(lastChecks[NotificationType.PASSWORD_EXPIRY], PASSWORD_CHECK_INTERVAL)
    ) {
      if (health.expired > 0) {
        await this.sendNotification(
          this.t('notification_password_expiry_warning_title'),
          this.t('notification_password_expiry_summary_body', { expiredCount: health.expired }),
          NotificationType.PASSWORD_EXPIRY,
        );
      }
      updatedChecks[NotificationType.PASSWORD_EXPIRY] = now;
    }

    return updatedChecks;
  }

  /**
   * Checks whether enough time has passed since the last check
   */
  private shouldRunCheck(lastCheck: number | undefined, interval: number): boolean {
    if (!lastCheck) return true;
    return Date.now() - lastCheck > interval;
  }
}

export default NotificationService.getInstance();
