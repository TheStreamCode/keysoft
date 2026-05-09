import { useCallback, useEffect, useState } from 'react';
import { Storage } from '../../services';
import NotificationService, { NotificationType } from '../../services/utils/notificationService';
import Logger from '../../utils/logger';
import { UserPreferences } from '../../models/User';

export const defaultNotificationSettings: Record<NotificationType, boolean> = {
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

interface UseNotificationSettingsParams {
  preferences: UserPreferences | null;
  setPreferences: (prefs: UserPreferences) => void;
  reloadPreferences: () => Promise<void>;
  t: (key: string) => string;
  alert: (
    title: string,
    message: string,
    buttons?: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  ) => void;
}

export const useNotificationSettings = ({
  preferences,
  setPreferences,
  reloadPreferences,
  t,
  alert,
}: UseNotificationSettingsParams) => {
  const [showOptions, setShowOptions] = useState(false);
  const [settings, setSettings] = useState<Record<NotificationType, boolean>>(
    defaultNotificationSettings,
  );

  // Auto-sync notification settings from preferences.
  // Runs when preferences change, such as after loadPreferences, removing
  // the need for an explicit call from the consumer.
  useEffect(() => {
    const stored = preferences?.notificationSettings;
    if (stored) {
      const merged: Record<NotificationType, boolean> = { ...defaultNotificationSettings };
      (Object.keys(stored) as NotificationType[]).forEach((key) => {
        if (stored[key] !== undefined) {
          merged[key] = !!stored[key];
        }
      });
      setSettings(merged);
      NotificationService.updateSettings(merged);
    } else if (preferences) {
      // Preferences are loaded without notificationSettings, so use defaults
      setSettings(defaultNotificationSettings);
      NotificationService.updateSettings(defaultNotificationSettings);
    }
  }, [preferences]);

  const toggleNotification = useCallback(
    async (type: NotificationType, value: boolean) => {
      if (!preferences) return;

      try {
        const updatedSettings = { ...settings, [type]: value };
        setSettings(updatedSettings);

        const updatedPreferences = { ...preferences, notificationSettings: updatedSettings };
        setPreferences(updatedPreferences);
        // NotificationService.updateSettings is called by the `preferences` useEffect
        // (see above). Do not duplicate the call here.
        await Storage.saveUserPreferences(updatedPreferences);

        Logger.info(`Notifica ${type} ${value ? 'attivata' : 'disattivata'} con successo`);
      } catch (error) {
        Logger.error("Errore durante l'aggiornamento delle notifiche:", error);
        alert(t('error'), t('notification_update_error'));
        await reloadPreferences();
      }
    },
    [preferences, settings, setPreferences, reloadPreferences, t, alert],
  );

  return {
    showOptions,
    setShowOptions,
    settings,
    setSettings,
    toggleNotification,
  };
};
