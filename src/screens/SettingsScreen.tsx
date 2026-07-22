import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Linking,
} from 'react-native';
import packageJson from '../../package.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { AppTheme } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Storage, Auth } from '../services';
import Logger from '../utils/logger';
import { UserPreferences, ThemeMode } from '../models/User';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import ScreenCaptureService from '../services/utils/screenCaptureService';
import { useAlert } from '../contexts/AlertContext';
import AutoLockService from '../services/utils/autoLockService';
import ClipboardService from '../services/utils/clipboardService';
import NotificationService, { NotificationType } from '../services/utils/notificationService';
import Constants from 'expo-constants';
import { ListItem } from '../components/ui/list-item';
import UISwitch from '../components/ui/switch';
import Divider from '../components/ui/divider';
import BottomSheet, { BottomSheetOption, BottomSheetButton } from '../components/ui/bottom-sheet';
import { usePinManagement } from '../hooks/settings/usePinManagement';
import {
  useNotificationSettings,
  defaultNotificationSettings,
} from '../hooks/settings/useNotificationSettings';
import { useProfileForm } from '../hooks/settings/useProfileForm';
import { useExportImport } from '../hooks/settings/useExportImport';
import { MotionPressable, Reveal } from '../components/ui/motion';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Dialog } from '../components/ui/dialog';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

// Static flag tracking whether the notification has already been disabled
// It stays active even if the component is remounted
let isNotificationDisabled = false;

// Temporarily disable backup notifications
function disableBackupNotifications() {
  if (!isNotificationDisabled) {
    // Save the original method only once
    const originalMethod = NotificationService.sendBackupReminder;

    // Replace the method with a no-op implementation
    NotificationService.sendBackupReminder = async () => {
      Logger.debug('Notifica di backup disabilitata permanentemente');
      return null;
    };

    // Set a flag indicating that notifications were disabled
    isNotificationDisabled = true;

    // Restore the original method after 5 seconds
    setTimeout(() => {
      if (isNotificationDisabled) {
        NotificationService.sendBackupReminder = originalMethod;
        isNotificationDisabled = false;
        Logger.debug('Notifica di backup ripristinata dopo timeout');
      }
    }, 5000);
  }
}

// defaultNotificationSettings is now exported by the useNotificationSettings hook

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Add state for the initial layout phase
  const [initialLayoutComplete, setInitialLayoutComplete] = useState(false);

  // PIN management state and logic are extracted into a dedicated hook
  // (replaces the previous 9 useState calls plus handleChangePin).
  // The hook is initialized after context hooks (see below, after useAlert/useAuth).

  // Profile form state is now managed by the useProfileForm hook (see below)

  const [showAutoLockOptions, setShowAutoLockOptions] = useState(false);
  const [showClipboardOptions, setShowClipboardOptions] = useState(false);
  // showNotificationOptions and notificationSettings are now managed by useNotificationSettings (see below)

  const { logout, updateMasterPassword, enableBiometrics } = useAuth();
  const { theme, isDarkMode, setThemeMode, themeMode } = useTheme();
  const { t, language, effectiveLanguage, setLanguage } = useLanguage();
  const { alert } = useAlert();

  // PIN management hook (replaces 9 useState calls plus handleChangePin)
  const pin = usePinManagement({ updateMasterPassword, t, alert });
  const {
    showModal: showChangePinModal,
    setShowModal: setShowChangePinModal,
    currentPin,
    setCurrentPin,
    newPin,
    setNewPin,
    confirmNewPin,
    setConfirmNewPin,
    error: pinError,
    showCurrentPin,
    setShowCurrentPin,
    showNewPin,
    setShowNewPin,
    showConfirmNewPin,
    setShowConfirmNewPin,
    isChanging: isChangingPin,
    handleChangePin,
    closeModal: closeChangePinModal,
  } = pin;

  // selectedImage and showImageSourceModal are now managed by useProfileForm (see below)

  // Export and import state are now managed by useExportImport (see below)

  // App reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Language options modal
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  // Add state for theme-selection modal visibility
  const [showThemeOptions, setShowThemeOptions] = useState(false);

  // Avatar synchronization is handled internally by useProfileForm

  // Disable backup notifications immediately when the component mounts
  // to prevent unwanted notifications
  useEffect(() => {
    disableBackupNotifications();

    return () => {
      // If the component unmounts before the timeout,
      // the restore timer will re-enable notifications
    };
  }, []);

  // Add an effect to handle the initial layout phase
  useEffect(() => {
    // Use a short timeout to ensure the layout is calculated correctly
    const layoutTimeout = setTimeout(() => {
      setInitialLayoutComplete(true);
    }, 100);

    return () => clearTimeout(layoutTimeout);
  }, []);

  const savePreferences = useCallback(
    async (newPreferences: UserPreferences) => {
      try {
        await Storage.saveUserPreferences(newPreferences);
        setPreferences(newPreferences);
      } catch (error) {
        Logger.error('Errore durante il salvataggio delle preferenze:', error);
        alert(t('error'), t('preferences_save_error'));
      }
    },
    [t, alert],
  );

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const userPreferences = await Storage.getUserPreferences();

      // Ensure the defaults are set to 1 minute (60 seconds)
      const updatedPreferences = {
        ...userPreferences,
        autoLockTimeout: userPreferences?.autoLockTimeout ?? 60,
        clipboardClearTimeout: userPreferences?.clipboardClearTimeout ?? 60,
      };

      // Force values to 60 seconds if they differ from the expected defaults
      if (
        updatedPreferences.autoLockTimeout !== 0 &&
        updatedPreferences.autoLockTimeout !== 60 &&
        updatedPreferences.autoLockTimeout !== 300
      ) {
        updatedPreferences.autoLockTimeout = 60;
      }

      if (
        updatedPreferences.clipboardClearTimeout !== 0 &&
        updatedPreferences.clipboardClearTimeout !== 60 &&
        updatedPreferences.clipboardClearTimeout !== 300
      ) {
        updatedPreferences.clipboardClearTimeout = 60;
      }

      setPreferences(updatedPreferences);
      // Notifications are synchronized automatically by useNotificationSettings
      // through a useEffect on `preferences`; no explicit call is required.
    } catch (error) {
      Logger.error('Errore durante il caricamento delle preferenze:', error);
      // On error, apply default preferences to prevent UI crashes
      setPreferences({
        autoLockTimeout: 60,
        biometricsEnabled: false,
        clipboardClearTimeout: 60,
        language: 'it',
        passwordGeneratorSettings: {
          length: 16,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilarCharacters: false,
        },
        screenshotProtectionEnabled: false,
        notificationSettings: defaultNotificationSettings,
        username: t('user'),
        hasPromptedForBiometrics: false,
      });
      alert(t('error'), t('preferences_load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t, alert]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Notification settings hook (replaces notificationSettings state plus handleToggleNotification).
  // Declare it after loadPreferences so it can be passed as reloadPreferences.
  const notifications = useNotificationSettings({
    preferences,
    setPreferences,
    reloadPreferences: loadPreferences,
    t,
    alert,
  });
  const {
    showOptions: showNotificationOptions,
    setShowOptions: setShowNotificationOptions,
    settings: notificationSettings,
    setSettings: setNotificationSettings,
    toggleNotification: handleToggleNotification,
  } = notifications;

  const handleToggleSecurityReminders = useCallback(
    async (value: boolean) => {
      if (!preferences) return;

      const updatedSettings = {
        ...notificationSettings,
        [NotificationType.PASSWORD_EXPIRY]: value,
        [NotificationType.WEAK_PASSWORD]: value,
        [NotificationType.DUPLICATE_PASSWORD]: value,
      };
      const updatedPreferences = { ...preferences, notificationSettings: updatedSettings };

      try {
        setNotificationSettings(updatedSettings);
        setPreferences(updatedPreferences);
        await Storage.saveUserPreferences(updatedPreferences);
      } catch (error) {
        Logger.error('Unable to update security reminders', error);
        alert(t('error'), t('notification_update_error'));
        await loadPreferences();
      }
    },
    [alert, loadPreferences, notificationSettings, preferences, setNotificationSettings, t],
  );

  // Profile form hook (replaces showProfileModal/tempUsername/profileError, selectedImage, and image picker handlers).
  const profileForm = useProfileForm({ preferences, setPreferences, setIsSaving, t });
  const {
    showModal: showProfileModal,
    tempUsername,
    setTempUsername,
    error: profileError,
    selectedImage,
    showImageSourceModal,
    setShowImageSourceModal,
    openProfileModal,
    closeProfileModal,
    openImageSourceModal,
    handleSaveProfile,
    pickImageFromGallery,
    takePhoto,
  } = profileForm;

  // Export/import hook (replaces export/import state and handlers).
  const exportImport = useExportImport({
    preferences,
    setPreferences,
    disableBackupNotifications,
    t,
    alert,
  });
  const {
    exportEncrypted,
    exportPassword,
    setExportPassword,
    showExportDialog,
    setShowExportDialog,
    handleExportPasswords,
    performExport,
    importPassword,
    setImportPassword,
    showImportPasswordDialog,
    setShowImportPasswordDialog,
    handleImportPasswords,
    handleDecryptAndImport,
  } = exportImport;

  const handleToggleBiometrics = async (value: boolean) => {
    if (!preferences) return;

    if (value) {
      try {
        const { available } = await Auth.isBiometricsAvailable();
        Logger.debug(`Biometria disponibile: ${available}`);

        if (!available) {
          alert(t('biometrics_not_available'), t('biometrics_not_available_device'));
          return;
        }

        alert(t('enable_biometrics_title'), t('enable_biometrics_message'), [
          { text: t('cancel'), onPress: () => {}, style: 'cancel' },
          {
            text: t('enable_biometrics_enable'),
            onPress: async () => {
              try {
                const enabled = await enableBiometrics();

                if (enabled) {
                  const updatedPreferences = await Storage.getUserPreferences();
                  setPreferences(updatedPreferences);

                  alert(t('biometrics_enabled'), t('biometrics_enabled_message'));
                } else {
                  alert(t('error'), t('biometrics_verification_error'));
                }
              } catch (error) {
                Logger.error("Errore durante l'abilitazione della biometria:", error);
                alert(t('error'), t('biometrics_setup_error'));
              }
            },
          },
        ]);
      } catch (error) {
        Logger.error("Errore durante l'attivazione della biometria:", error);
        alert(t('error'), t('biometrics_setup_error'));
      }
    } else {
      // Disable biometrics
      Logger.debug('Disattivazione biometria...');

      // Update preferences
      const updatedPreferences = {
        ...preferences,
        biometricsEnabled: false,
      };

      // Save preferences immediately
      try {
        await Storage.saveUserPreferences(updatedPreferences);
        await Storage.deleteBiometricKey();
        Logger.debug('Preferenze salvate con successo, biometria disattivata');

        // Update local state
        setPreferences(updatedPreferences);

        // Verify that preferences were saved correctly
        const savedPreferences = await Storage.getUserPreferences();
        Logger.debug('Preferenze salvate:', savedPreferences);
        Logger.debug(
          `Biometria disabilitata nelle preferenze salvate: ${!savedPreferences.biometricsEnabled}`,
        );

        alert(t('biometrics_disabled'), t('biometrics_disabled_message'));
      } catch (error) {
        Logger.error('Errore durante il salvataggio delle preferenze:', error);
        alert(t('error'), t('biometrics_setup_error'));
      }
    }
  };

  const handleToggleScreenshotProtection = async (value: boolean) => {
    if (!preferences) return;

    try {
      // Create an updatedPreferences object with the new value
      const updatedPreferences = {
        ...preferences,
        screenshotProtectionEnabled: value,
      };

      // Update local state
      setPreferences(updatedPreferences);

      // Save the updated preferences
      await savePreferences(updatedPreferences);

      // Apply screenshot protection immediately
      if (value) {
        Logger.debug('Attivazione protezione screenshot...');
        await ScreenCaptureService.preventScreenCapture();
        alert(t('screenshot_enabled'), t('screenshot_enabled_message'));
      } else {
        Logger.debug('Disattivazione protezione screenshot...');
        await ScreenCaptureService.allowScreenCapture();
        alert(t('screenshot_disabled'), t('screenshot_disabled_message'));
      }
    } catch (error) {
      Logger.error('Errore durante la gestione della protezione screenshot:', error);
      alert(t('error'), t('screenshot_toggle_error'));
    }
  };

  const handleChangeAutoLockTimeout = (value: number) => {
    if (!preferences) return;

    setIsSaving(true);
    const updatedPreferences = {
      ...preferences,
      autoLockTimeout: value,
    };

    // Save the updated preferences, not the original object
    savePreferences(updatedPreferences);

    // Also update local state
    setPreferences(updatedPreferences);

    // Update the auto-lock service timeout
    AutoLockService.updateTimeout(value);
    Logger.debug(`SettingsScreen: Timeout blocco automatico aggiornato a ${value} secondi`);
  };

  const handleChangeClipboardClearTimeout = (value: number) => {
    if (!preferences) return;

    setIsSaving(true);
    const updatedPreferences = {
      ...preferences,
      clipboardClearTimeout: value,
    };

    // Save the updated preferences, not the original object
    savePreferences(updatedPreferences);

    // Also update local state
    setPreferences(updatedPreferences);

    // Update the clipboard service timeout
    ClipboardService.updateDefaultTimeout(value);
    Logger.debug(`SettingsScreen: Timeout clipboard aggiornato a ${value} secondi`);
  };

  // handleChangePin is now provided by the usePinManagement hook (see above)

  const handleLogout = () => {
    alert(t('logout_confirmation'), t('logout_confirmation_message'), [
      { text: t('cancel'), onPress: () => {}, style: 'cancel' },
      {
        text: t('logout'),
        onPress: () => logout(),
        style: 'destructive',
      },
    ]);
  };

  const handleResetApp = async () => {
    if (resetConfirmText.toLowerCase() !== 'reset') {
      alert(t('reset_error'), t('reset_error_message'), [{ text: t('ok'), onPress: () => {} }]);
      return;
    }

    try {
      // Use clearAllData to remove all stored data
      await Storage.clearAllData();

      // Close the modal
      setShowResetModal(false);
      setResetConfirmText('');

      // Show the success message and perform a full-reset logout
      alert(t('reset_success'), t('reset_success_message'), [
        {
          text: t('ok'),
          onPress: () => logout(true), // Passa true per indicare reset completo
          style: 'default',
        },
      ]);
    } catch (error) {
      Logger.error("Errore durante il reset dell'app:", error);
      alert(t('reset_error'), t('reset_failed_message'), [{ text: t('ok'), onPress: () => {} }]);
    }
  };

  const getAutoLockTimeoutText = () => {
    if (preferences?.autoLockTimeout === 0) {
      return t('auto_lock_never');
    } else if (preferences?.autoLockTimeout === -1) {
      return t('auto_lock_immediate');
    } else if (preferences?.autoLockTimeout === 60) {
      return t('auto_lock_1min');
    } else if (preferences?.autoLockTimeout === 300) {
      return t('auto_lock_5min');
    } else if (preferences?.autoLockTimeout && preferences.autoLockTimeout > 60) {
      // Show minutes for values above 60 seconds
      return `${Math.floor(preferences.autoLockTimeout / 60)} min`;
    } else {
      // Show seconds for values below 60 seconds
      return `${preferences?.autoLockTimeout} sec`;
    }
  };

  // handleExportPasswords, performExport, handleImportPasswords, processImport,
  // and handleDecryptAndImport are provided by the useExportImport hook

  // handleToggleNotification is provided by the useNotificationSettings hook
  // handleSaveProfile, pickImageFromGallery, and takePhoto are provided by the useProfileForm hook

  // Render the image source selection modal
  const renderImageSourceModal = () => {
    return (
      <BottomSheet
        visible={showImageSourceModal}
        onClose={() => setShowImageSourceModal(false)}
        title={t('change_avatar')}
      >
        <BottomSheetOption
          icon="camera"
          iconColor={theme.colors.primary}
          label={t('take_photo')}
          onPress={() => {
            setShowImageSourceModal(false);
            takePhoto();
          }}
        />
        <BottomSheetOption
          icon="image"
          iconColor={theme.colors.primary}
          label={t('choose_from_gallery')}
          onPress={() => {
            setShowImageSourceModal(false);
            pickImageFromGallery();
          }}
        />
      </BottomSheet>
    );
  };

  // Change the theme
  const handleThemeChange = async (newThemeMode: ThemeMode) => {
    try {
      setIsSaving(true);

      // Update preferences locali
      const updatedPreferences: UserPreferences = {
        ...preferences!,
        themeMode: newThemeMode,
      };

      // Save preferences
      await Storage.saveUserPreferences(updatedPreferences);

      // Update local state
      setPreferences(updatedPreferences);

      // Update the app theme
      await setThemeMode(newThemeMode);

      // Chiudiamo il modal
      setShowThemeOptions(false);

      alert(t('theme_updated'), t('theme_updated_message'));
    } catch (error) {
      Logger.error("Errore durante l'aggiornamento del tema:", error);
      alert(t('error'), t('theme_update_error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Get the current theme label
  const getThemeText = () => {
    // Use themeMode directly from useTheme() to keep state consistent
    // with the theme currently displayed
    switch (themeMode) {
      case 'system':
        return isDarkMode ? t('theme_dark') : t('theme_light');
      case 'light':
        return t('theme_light');
      case 'dark':
        return t('theme_dark');
      default:
        return isDarkMode ? t('theme_dark') : t('theme_light');
    }
  };

  const securityRemindersEnabled =
    notificationSettings[NotificationType.PASSWORD_EXPIRY] &&
    notificationSettings[NotificationType.WEAK_PASSWORD] &&
    notificationSettings[NotificationType.DUPLICATE_PASSWORD];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        !initialLayoutComplete && { opacity: 0.99 }, // Trucco per forzare un re-render migliorando il posizionamento
      ]}
      edges={['top']} // Specificare esattamente quali bordi considerare per il safe area
    >
      {/* Auto Lock Timeout - BottomSheet */}
      <BottomSheet
        visible={showAutoLockOptions}
        onClose={() => setShowAutoLockOptions(false)}
        title={t('select_auto_lock_time')}
      >
        <BottomSheetOption
          icon="close-circle"
          iconColor={theme.colors.error}
          label={t('never')}
          selected={preferences?.autoLockTimeout === 0}
          onPress={() => {
            handleChangeAutoLockTimeout(0);
            setShowAutoLockOptions(false);
          }}
        />
        <BottomSheetOption
          icon="time"
          iconColor={theme.colors.success}
          label={t('1_minute')}
          selected={preferences?.autoLockTimeout === 60}
          onPress={() => {
            handleChangeAutoLockTimeout(60);
            setShowAutoLockOptions(false);
          }}
        />
        <BottomSheetOption
          icon="time"
          iconColor={theme.colors.warning}
          label={t('5_minutes')}
          selected={preferences?.autoLockTimeout === 300}
          onPress={() => {
            handleChangeAutoLockTimeout(300);
            setShowAutoLockOptions(false);
          }}
        />
      </BottomSheet>

      {/* Clipboard Timeout - BottomSheet */}
      <BottomSheet
        visible={showClipboardOptions}
        onClose={() => setShowClipboardOptions(false)}
        title={t('select_clipboard_timeout')}
      >
        <BottomSheetOption
          icon="close-circle"
          iconColor={theme.colors.error}
          label={t('never')}
          selected={preferences?.clipboardClearTimeout === 0}
          onPress={() => {
            handleChangeClipboardClearTimeout(0);
            setShowClipboardOptions(false);
          }}
        />
        <BottomSheetOption
          icon="time"
          iconColor={theme.colors.success}
          label={t('1_minute')}
          selected={preferences?.clipboardClearTimeout === 60}
          onPress={() => {
            handleChangeClipboardClearTimeout(60);
            setShowClipboardOptions(false);
          }}
        />
        <BottomSheetOption
          icon="time"
          iconColor={theme.colors.warning}
          label={t('5_minutes')}
          selected={preferences?.clipboardClearTimeout === 300}
          onPress={() => {
            handleChangeClipboardClearTimeout(300);
            setShowClipboardOptions(false);
          }}
        />
      </BottomSheet>

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: 23,
              fontWeight: '600',
            },
          ]}
        >
          {t('settings')}
        </Text>
      </View>

      <ScrollView
        style={styles.compactScrollView}
        contentContainerStyle={styles.compactScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reveal>
          <MotionPressable
            accessibilityLabel={t('edit_profile')}
            accessibilityRole="button"
            onPress={openProfileModal}
            style={[styles.compactProfile, { backgroundColor: theme.colors.backgroundElevated }]}
          >
            <ProfileAvatar
              name={preferences?.username || t('user')}
              size={44}
              testID="settings-profile-avatar"
              uri={preferences?.avatar}
            />
            <View style={styles.compactProfileCopy}>
              <Text style={[styles.compactProfileName, { color: theme.colors.text }]}>
                {preferences?.username || t('user')}
              </Text>
              <Text style={[styles.compactProfileMeta, { color: theme.colors.textTertiary }]}>
                {t('edit_profile')}
              </Text>
            </View>
            <Text style={[styles.compactEditText, { color: theme.colors.primary }]}>
              {t('edit')}
            </Text>
          </MotionPressable>
        </Reveal>

        <Reveal delay={35}>
          <Text style={[styles.compactSectionLabel, { color: theme.colors.textTertiary }]}>
            {t('security')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              leftIcon="key-outline"
              title={t('change_pin')}
              onPress={() => setShowChangePinModal(true)}
              rightIcon="chevron-forward"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="finger-print-outline"
              title={t('biometrics')}
              rightIcon={
                <UISwitch
                  accessibilityLabel={t('biometrics')}
                  onValueChange={handleToggleBiometrics}
                  value={preferences?.biometricsEnabled || false}
                />
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="eye-off-outline"
              title={t('screenshot_protection')}
              rightIcon={
                <UISwitch
                  accessibilityLabel={t('screenshot_protection')}
                  onValueChange={handleToggleScreenshotProtection}
                  value={preferences?.screenshotProtectionEnabled || false}
                />
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="lock-closed-outline"
              title={t('auto_lock')}
              onPress={() => setShowAutoLockOptions(true)}
              rightIcon={
                <View style={styles.compactValueRow}>
                  <Text style={[styles.compactValue, { color: theme.colors.textTertiary }]}>
                    {getAutoLockTimeoutText()}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
                </View>
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="clipboard-outline"
              title={t('clipboard_timeout')}
              onPress={() => setShowClipboardOptions(true)}
              rightIcon={
                <View style={styles.compactValueRow}>
                  <Text style={[styles.compactValue, { color: theme.colors.textTertiary }]}>
                    {preferences?.clipboardClearTimeout === 0
                      ? t('clipboard_never')
                      : preferences?.clipboardClearTimeout === 60
                        ? t('clipboard_1min')
                        : preferences?.clipboardClearTimeout === 300
                          ? t('clipboard_5min')
                          : `${Math.floor((preferences?.clipboardClearTimeout || 0) / 60)} min`}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
                </View>
              }
              style={styles.compactRow}
            />
          </View>
        </Reveal>

        <Reveal delay={70}>
          <Text style={[styles.compactSectionLabel, { color: theme.colors.textTertiary }]}>
            {t('general')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              leftIcon={themeMode === 'light' ? 'sunny-outline' : 'moon-outline'}
              title={t('theme')}
              onPress={() => setShowThemeOptions(true)}
              rightIcon={
                <View style={styles.compactValueRow}>
                  <Text style={[styles.compactValue, { color: theme.colors.textTertiary }]}>
                    {getThemeText()}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
                </View>
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="language-outline"
              title={t('language')}
              onPress={() => setShowLanguageOptions(true)}
              rightIcon={
                <View style={styles.compactValueRow}>
                  <Text style={[styles.compactValue, { color: theme.colors.textTertiary }]}>
                    {language === 'system'
                      ? t('language_system')
                      : language === 'it'
                        ? t('language_italian')
                        : t('language_english')}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
                </View>
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="notifications-outline"
              title={t('security_reminders')}
              rightIcon={
                <UISwitch
                  accessibilityLabel={t('security_reminders')}
                  onValueChange={(value) => void handleToggleSecurityReminders(value)}
                  value={securityRemindersEnabled}
                />
              }
              style={styles.compactRow}
            />
          </View>
        </Reveal>

        <Reveal delay={105}>
          <Text style={[styles.compactSectionLabel, { color: theme.colors.textTertiary }]}>
            {t('data')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              leftIcon="download-outline"
              title={t('export_data')}
              onPress={handleExportPasswords}
              rightIcon="chevron-forward"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="push-outline"
              title={t('import_data')}
              onPress={handleImportPasswords}
              rightIcon="chevron-forward"
              style={styles.compactRow}
            />
          </View>
        </Reveal>

        <Reveal delay={140}>
          <Text style={[styles.compactSectionLabel, { color: theme.colors.textTertiary }]}>
            {t('information')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              leftIcon="information-circle-outline"
              title={t('version')}
              rightIcon={
                <Text style={[styles.compactValue, { color: theme.colors.textTertiary }]}>
                  {Constants.expoConfig?.version || packageJson.version}
                </Text>
              }
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="shield-checkmark-outline"
              title={t('vault_health_title')}
              onPress={() => navigation.navigate('VaultHealth')}
              rightIcon="chevron-forward"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="help-circle-outline"
              title={t('support')}
              onPress={() => Linking.openURL(`https://mikesoft.it/${effectiveLanguage}/support/`)}
              rightIcon="open-outline"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="document-text-outline"
              title={t('privacy_policy')}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              rightIcon="chevron-forward"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              leftIcon="code-slash-outline"
              title={t('open_source')}
              onPress={() => navigation.navigate('OpenSource')}
              rightIcon="chevron-forward"
              style={styles.compactRow}
            />
          </View>
        </Reveal>

        <Reveal delay={175}>
          <Text style={[styles.compactSectionLabel, { color: theme.colors.textTertiary }]}>
            {t('account')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              iconColor={theme.colors.error}
              leftIcon="log-out-outline"
              title={t('logout')}
              onPress={handleLogout}
              rightIcon="chevron-forward"
              style={[styles.compactRow, { borderBottomColor: theme.colors.divider }]}
            />
            <ListItem
              iconColor={theme.colors.error}
              leftIcon="trash-outline"
              title={t('reset_app')}
              onPress={() => setShowResetModal(true)}
              rightIcon="chevron-forward"
              style={styles.compactRow}
            />
          </View>
        </Reveal>
      </ScrollView>

      <ScrollView
        style={styles.legacyScrollView}
        contentContainerStyle={[styles.scrollViewContent, { paddingBottom: 100 }]}
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('profile')}
          </Text>

          <ListItem
            title={preferences?.username || t('user')}
            description={t('edit_profile')}
            onPress={openProfileModal}
            leftIcon={
              <ProfileAvatar
                name={preferences?.username || t('user')}
                size={46}
                uri={preferences?.avatar}
              />
            }
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('personalization')}
          </Text>

          <ListItem
            title={t('theme')}
            description={getThemeText()}
            leftIcon={
              <Ionicons
                name={themeMode === 'light' ? 'sunny' : themeMode === 'dark' ? 'moon' : 'settings'}
                size={24}
                color={
                  themeMode === 'light' ? '#FFA500' : themeMode === 'dark' ? '#4169E1' : '#9B59B6'
                }
              />
            }
            onPress={() => setShowThemeOptions(true)}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />
          <Divider />

          <ListItem
            title={t('language')}
            description={
              language === 'system'
                ? t('language_system')
                : language === 'it'
                  ? t('language_italian')
                  : t('language_english')
            }
            leftIcon={
              <Image
                source={
                  language === 'system'
                    ? require('../../assets/world-flag.png')
                    : language === 'it'
                      ? require('../../assets/ita-flag.png')
                      : require('../../assets/gb-flag.png')
                }
                style={{ width: 24, height: 24, borderRadius: 2 }}
              />
            }
            onPress={() => setShowLanguageOptions(true)}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('security')}
          </Text>

          <ListItem
            title={t('change_pin')}
            description={t('change_pin_description')}
            onPress={() => setShowChangePinModal(true)}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />

          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                {t('biometrics')}
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text + '80' }]}>
                {t('biometrics_description')}
              </Text>
            </View>
            <UISwitch
              value={preferences?.biometricsEnabled || false}
              onValueChange={handleToggleBiometrics}
              accessibilityLabel={t('biometrics')}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                {t('screenshot_protection')}
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text + '80' }]}>
                {t('screenshot_protection_description')}
              </Text>
            </View>
            <UISwitch
              value={preferences?.screenshotProtectionEnabled || false}
              onValueChange={handleToggleScreenshotProtection}
              accessibilityLabel={t('screenshot_protection')}
            />
          </View>

          <ListItem
            title={t('auto_lock')}
            description={t('auto_lock_description')}
            onPress={() => setShowAutoLockOptions(true)}
            rightIcon={
              <Text style={[styles.pickerButtonText, { color: theme.colors.primary }]}>
                {getAutoLockTimeoutText()}
              </Text>
            }
          />

          <ListItem
            title={t('clipboard_timeout')}
            description={t('clipboard_timeout_description')}
            onPress={() => setShowClipboardOptions(true)}
            rightIcon={
              <Text style={[styles.pickerButtonText, { color: theme.colors.primary }]}>
                {preferences?.clipboardClearTimeout === 0
                  ? t('clipboard_never')
                  : preferences?.clipboardClearTimeout === 60
                    ? t('clipboard_1min')
                    : preferences?.clipboardClearTimeout === 300
                      ? t('clipboard_5min')
                      : `${Math.floor((preferences?.clipboardClearTimeout || 0) / 60)} min`}
              </Text>
            }
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('notifications')}
          </Text>

          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.settingItemTouchable}
              onPress={() => setShowNotificationOptions(!showNotificationOptions)}
            >
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  {t('notification_types')}
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.text + '80' }]}>
                  {t('notification_types_description')}
                </Text>
              </View>
              <Ionicons
                name={showNotificationOptions ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>

          {showNotificationOptions && (
            <View
              style={[
                styles.notificationOptionsContainer,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              {Object.entries(notificationSettings)
                // Filter out auto-lock and clipboard-timeout notifications
                .filter(
                  ([type, _]) =>
                    type !== NotificationType.AUTO_LOCK_WARNING &&
                    type !== NotificationType.CLIPBOARD_CLEAR_WARNING,
                )
                .map(([type, enabled], index, filteredArray) => {
                  const notificationType = type as NotificationType;
                  let icon = 'information-circle-outline';
                  let label = t('info');

                  switch (notificationType) {
                    case NotificationType.PASSWORD_EXPIRY:
                      icon = 'key-outline';
                      label = t('notification_expired_passwords');
                      break;
                    case NotificationType.WEAK_PASSWORD:
                      icon = 'key-outline';
                      label = t('notification_weak_passwords');
                      break;
                    case NotificationType.DUPLICATE_PASSWORD:
                      icon = 'key-outline';
                      label = t('notification_duplicate_passwords');
                      break;
                    case NotificationType.LOGIN_SUCCESS:
                      icon = 'log-in-outline';
                      label = t('notification_login_success');
                      break;
                    case NotificationType.LOGIN_FAILURE:
                      icon = 'log-in-outline';
                      label = t('notification_login_failure');
                      break;
                    case NotificationType.BACKUP_REMINDER:
                      icon = 'cloud-upload-outline';
                      label = t('notification_backup_reminder');
                      break;
                    case NotificationType.BACKUP_SUCCESS:
                      icon = 'cloud-download-outline';
                      label = t('notification_backup_success');
                      break;
                  }

                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.notificationOptionItem,
                        index < filteredArray.length - 1
                          ? { borderBottomColor: theme.colors.border }
                          : { borderBottomWidth: 0 },
                      ]}
                      onPress={() => handleToggleNotification(notificationType, !enabled)}
                    >
                      <View style={styles.notificationOptionTextContainer}>
                        <Ionicons
                          name={icon as any}
                          size={18}
                          color={theme.colors.text}
                          style={styles.notificationOptionIcon}
                        />
                        <Text style={[styles.notificationOptionText, { color: theme.colors.text }]}>
                          {label}
                        </Text>
                      </View>
                      <UISwitch
                        value={enabled}
                        onValueChange={(value) => handleToggleNotification(notificationType, value)}
                        accessibilityLabel={label}
                      />
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('data')}
          </Text>

          <ListItem
            title={t('export_data')}
            description={t('export_data_description')}
            onPress={handleExportPasswords}
            leftIcon={<Ionicons name="arrow-down" size={20} color={theme.colors.primary} />}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />

          <ListItem
            title={t('import_data')}
            description={t('import_data_description')}
            onPress={handleImportPasswords}
            leftIcon={<Ionicons name="arrow-up" size={20} color={theme.colors.primary} />}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('contribution')}
          </Text>

          <ListItem
            title={t('sponsor_github')}
            description={t('sponsor_github_description')}
            onPress={() => Linking.openURL('https://github.com/sponsors/TheStreamCode')}
            leftIcon={<Text style={{ fontSize: 18 }}>❤️</Text>}
            rightIcon={<Ionicons name="open-outline" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('account')}
          </Text>

          <ListItem
            title={t('logout')}
            description={t('logout_description')}
            onPress={handleLogout}
            leftIcon={<Ionicons name="log-out-outline" size={20} color={theme.colors.error} />}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />

          <ListItem
            title={t('reset_app')}
            description={t('reset_app_description')}
            onPress={() => setShowResetModal(true)}
            leftIcon={<Ionicons name="refresh-outline" size={20} color={theme.colors.error} />}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {t('information')}
          </Text>

          <ListItem
            title={t('version')}
            rightIcon={
              <Text style={{ color: theme.colors.textSecondary }}>
                {Constants.expoConfig?.version || packageJson.version || '1.6'}
              </Text>
            }
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />

          <ListItem
            title={t('support')}
            description={t('support_description')}
            onPress={() => Linking.openURL(`https://mikesoft.it/${effectiveLanguage}/support/`)}
            rightIcon={<Ionicons name="open-outline" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />

          <ListItem
            title={t('vault_health_title')}
            description={t('vault_health_description')}
            onPress={() => navigation.navigate('VaultHealth')}
            leftIcon={
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
            }
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />

          <ListItem
            title={t('privacy_policy')}
            description={t('privacy_policy_description')}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
            style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          />
          <ListItem
            title={t('open_source')}
            description={t('open_source_description')}
            onPress={() => navigation.navigate('OpenSource')}
            rightIcon={<Ionicons name="chevron-forward" size={20} color={theme.colors.text} />}
          />
        </View>
      </ScrollView>

      {/* Change PIN - BottomSheet */}
      <BottomSheet
        visible={showChangePinModal}
        onClose={closeChangePinModal}
        title={t('change_pin_title')}
      >
        <View>
          <Text
            style={[
              styles.pinRequirement,
              { color: theme.colors.text + '80', marginBottom: AppTheme.spacing.m },
            ]}
          >
            {t('pin_requirement')}
          </Text>

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.backgroundLight,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, flex: 1 }]}
              placeholder={t('current_pin')}
              placeholderTextColor={theme.colors.text + '80'}
              value={currentPin}
              onChangeText={setCurrentPin}
              secureTextEntry={!showCurrentPin}
              keyboardType="numeric"
              maxLength={6}
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPin(!showCurrentPin)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showCurrentPin ? 'eye-off' : 'eye'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.backgroundLight,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, flex: 1 }]}
              placeholder={t('new_pin')}
              placeholderTextColor={theme.colors.text + '80'}
              value={newPin}
              onChangeText={setNewPin}
              secureTextEntry={!showNewPin}
              keyboardType="numeric"
              maxLength={6}
            />
            <TouchableOpacity onPress={() => setShowNewPin(!showNewPin)} style={styles.eyeIcon}>
              <Ionicons
                name={showNewPin ? 'eye-off' : 'eye'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.backgroundLight,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, flex: 1 }]}
              placeholder={t('confirm_new_pin')}
              placeholderTextColor={theme.colors.text + '80'}
              value={confirmNewPin}
              onChangeText={setConfirmNewPin}
              secureTextEntry={!showConfirmNewPin}
              keyboardType="numeric"
              maxLength={6}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmNewPin(!showConfirmNewPin)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmNewPin ? 'eye-off' : 'eye'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {pinError ? (
            <Text
              style={[
                styles.errorText,
                { color: theme.colors.error, marginBottom: AppTheme.spacing.m },
              ]}
            >
              {pinError}
            </Text>
          ) : null}
        </View>

        <BottomSheetButton
          label={t('confirm')}
          variant="primary"
          onPress={handleChangePin}
          disabled={isChangingPin}
        />
        <BottomSheetButton
          label={t('cancel')}
          variant="secondary"
          onPress={closeChangePinModal}
          disabled={isChangingPin}
        />
      </BottomSheet>

      {/* Profile Edit - BottomSheet */}
      <BottomSheet
        visible={showProfileModal}
        onClose={closeProfileModal}
        title={t('edit_profile_title')}
      >
        <View>
          <MotionPressable
            accessibilityLabel={t('tap_to_change_image')}
            accessibilityRole="button"
            onPress={openImageSourceModal}
            style={[
              styles.avatarContainer,
              { alignItems: 'center', marginBottom: AppTheme.spacing.l },
            ]}
          >
            <View style={styles.editAvatarContainer}>
              <ProfileAvatar name={tempUsername} size={80} uri={selectedImage || undefined} />
              <View style={styles.cameraIconContainer}>
                <Ionicons name="camera" size={18} color={theme.colors.textLight} />
              </View>
            </View>
            <Text
              style={[
                styles.avatarHint,
                { color: theme.colors.text + '80', marginTop: AppTheme.spacing.s },
              ]}
            >
              {t('tap_to_change_image')}
            </Text>
          </MotionPressable>

          <View
            style={[
              styles.profileInputContainer,
              {
                backgroundColor: theme.colors.backgroundLight,
                borderColor: theme.colors.border,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <View style={styles.profileInputIcon}>
              <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
            </View>
            <TextInput
              style={[
                styles.profileTextInput,
                {
                  color: theme.colors.text,
                },
              ]}
              placeholder={t('name_placeholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={tempUsername}
              onChangeText={setTempUsername}
              maxLength={10}
              autoCapitalize="words"
              multiline={false}
              numberOfLines={1}
              textContentType="name"
              returnKeyType="done"
            />
          </View>

          {profileError ? (
            <Text
              style={[
                styles.errorText,
                { color: theme.colors.error, marginBottom: AppTheme.spacing.m },
              ]}
            >
              {profileError}
            </Text>
          ) : null}
        </View>

        <BottomSheetButton
          label={isSaving ? t('saving') : t('save')}
          variant="primary"
          onPress={handleSaveProfile}
          disabled={isSaving}
        />
        <BottomSheetButton label={t('cancel')} variant="secondary" onPress={closeProfileModal} />
      </BottomSheet>

      {renderImageSourceModal()}

      {/* Export Passwords - BottomSheet */}
      <BottomSheet
        visible={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        title={t('export_passwords_title')}
      >
        <View>
          <Text
            style={[
              styles.modalText,
              { color: theme.colors.text, marginBottom: AppTheme.spacing.m },
            ]}
          >
            {t('export_passwords_message_encrypted_only')}
          </Text>

          {/* Removed Toggle - Encryption is Mandatory */}

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.backgroundLight,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text }]}
              value={exportPassword}
              onChangeText={setExportPassword}
              secureTextEntry
              placeholder={t('enter_encryption_password')}
              placeholderTextColor={theme.colors.text + '60'}
            />
          </View>
        </View>

        <BottomSheetButton
          label={t('export')}
          variant="primary"
          onPress={() => {
            if (exportEncrypted && !exportPassword) {
              alert(t('error'), t('enter_encryption_password_error'), [
                { text: t('ok'), onPress: () => {}, style: 'default' },
              ]);
              return;
            }
            setShowExportDialog(false);
            performExport(false);
          }}
          disabled={exportEncrypted && !exportPassword}
        />
        <BottomSheetButton
          label={t('cancel')}
          variant="secondary"
          onPress={() => {
            // If cancelled, do nothing or just close
            setShowExportDialog(false);
          }}
        />
      </BottomSheet>

      {/* Import Decryption Password - BottomSheet */}
      <BottomSheet
        visible={showImportPasswordDialog}
        onClose={() => setShowImportPasswordDialog(false)}
        title={t('import_encrypted')}
      >
        <View>
          <Text
            style={[
              styles.modalText,
              { color: theme.colors.text, marginBottom: AppTheme.spacing.m },
            ]}
          >
            {t('enter_decryption_password')}
          </Text>

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.backgroundLight,
                marginBottom: AppTheme.spacing.m,
              },
            ]}
          >
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text }]}
              value={importPassword}
              onChangeText={setImportPassword}
              secureTextEntry
              placeholder={t('decryption_password_placeholder')}
              placeholderTextColor={theme.colors.text + '60'}
            />
          </View>
        </View>

        <BottomSheetButton
          label={t('decrypt')}
          variant="primary"
          onPress={handleDecryptAndImport}
          disabled={!importPassword}
        />
        <BottomSheetButton
          label={t('cancel')}
          variant="secondary"
          onPress={() => setShowImportPasswordDialog(false)}
        />
      </BottomSheet>

      {/* Theme Selection - BottomSheet */}
      <BottomSheet
        visible={showThemeOptions}
        onClose={() => setShowThemeOptions(false)}
        title={t('select_theme')}
      >
        <BottomSheetOption
          icon="sunny"
          iconColor={theme.colors.primary}
          label={t('theme_light')}
          selected={themeMode === 'light'}
          onPress={() => {
            handleThemeChange('light');
            setShowThemeOptions(false);
          }}
        />
        <BottomSheetOption
          icon="moon"
          iconColor={theme.colors.primary}
          label={t('theme_dark')}
          selected={themeMode === 'dark'}
          onPress={() => {
            handleThemeChange('dark');
            setShowThemeOptions(false);
          }}
        />
        <BottomSheetOption
          icon="settings"
          iconColor={theme.colors.primary}
          label={t('theme_auto')}
          selected={themeMode === 'system'}
          onPress={() => {
            handleThemeChange('system');
            setShowThemeOptions(false);
          }}
        />
      </BottomSheet>

      {/* Language Selection - BottomSheet */}
      <BottomSheet
        visible={showLanguageOptions}
        onClose={() => setShowLanguageOptions(false)}
        title={t('select_language')}
      >
        <BottomSheetOption
          iconImage={require('../../assets/world-flag.png')}
          label={t('language_system')}
          selected={language === 'system'}
          onPress={async () => {
            try {
              const prefs = await Storage.getUserPreferences();
              await Storage.saveUserPreferences({ ...prefs, language: 'system' });
              setLanguage('system');
              setShowLanguageOptions(false);
            } catch (e) {
              Logger.error('Errore durante il salvataggio della lingua:', e);
              setShowLanguageOptions(false);
            }
          }}
        />
        <BottomSheetOption
          iconImage={require('../../assets/ita-flag.png')}
          label={t('language_italian')}
          selected={language === 'it'}
          onPress={async () => {
            try {
              const prefs = await Storage.getUserPreferences();
              await Storage.saveUserPreferences({ ...prefs, language: 'it' });
              setLanguage('it');
              setShowLanguageOptions(false);
            } catch (e) {
              Logger.error('Errore durante il salvataggio della lingua:', e);
              setShowLanguageOptions(false);
            }
          }}
        />
        <BottomSheetOption
          iconImage={require('../../assets/gb-flag.png')}
          label={t('language_english')}
          selected={language === 'en'}
          onPress={async () => {
            try {
              const prefs = await Storage.getUserPreferences();
              await Storage.saveUserPreferences({ ...prefs, language: 'en' });
              setLanguage('en');
              setShowLanguageOptions(false);
            } catch (e) {
              Logger.error('Errore durante il salvataggio della lingua:', e);
              setShowLanguageOptions(false);
            }
          }}
        />
      </BottomSheet>

      <Dialog
        actions={[
          {
            label: t('cancel'),
            variant: 'secondary',
            onPress: () => {
              setShowResetModal(false);
              setResetConfirmText('');
            },
          },
          {
            label: t('reset_app'),
            variant: 'destructive',
            disabled: resetConfirmText.toLowerCase() !== 'reset',
            onPress: handleResetApp,
          },
        ]}
        description={t('reset_app_warning')}
        icon="trash-outline"
        onClose={() => {
          setShowResetModal(false);
          setResetConfirmText('');
        }}
        title={t('reset_app')}
        tone="destructive"
        visible={showResetModal}
      >
        <Text
          style={[
            styles.modalDescription,
            { color: theme.colors.text, fontWeight: '600', marginBottom: 10, marginTop: 16 },
          ]}
        >
          {t('reset_app_confirm_prompt')}
        </Text>
        <View
          style={[
            styles.inputContainer,
            {
              borderColor: theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground,
            },
          ]}
        >
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setResetConfirmText}
            placeholder={t('reset_placeholder')}
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.modalInput, { color: theme.colors.inputText }]}
            value={resetConfirmText}
          />
        </View>
      </Dialog>

      <Dialog
        description={t('please_wait')}
        dismissible={false}
        iconElement={<ActivityIndicator color={theme.colors.primary} size="small" />}
        onClose={() => {}}
        title={t('updating_pin')}
        visible={isChangingPin}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  title: {
    textAlign: 'left',
    letterSpacing: -0.35,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  legacyScrollView: {
    display: 'none',
  },
  compactScrollView: { flex: 1 },
  compactScrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  compactProfile: {
    minHeight: 66,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactAvatarText: { fontSize: 13, fontWeight: '700' },
  compactProfileCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  compactProfileName: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  compactProfileMeta: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  compactEditText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  compactSectionLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 2,
  },
  compactGroup: { overflow: 'hidden' },
  compactRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  compactValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactValue: { fontSize: 10, lineHeight: 14 },
  scrollViewContent: {
    padding: AppTheme.spacing.l,
  },
  section: {
    marginBottom: AppTheme.spacing.l,
    borderRadius: AppTheme.borderRadius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    padding: AppTheme.spacing.l,
    borderBottomWidth: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: AppTheme.spacing.l,
    borderBottomWidth: 1,
  },
  settingItemTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: AppTheme.spacing.m,
  },
  settingLabel: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: AppTheme.fonts.sizes.small,
  },
  pickerButton: {
    paddingHorizontal: AppTheme.spacing.m,
    paddingVertical: AppTheme.spacing.s,
    borderRadius: AppTheme.borderRadius.medium,
  },
  pickerButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400, // Fix: limita la larghezza massima
    borderRadius: AppTheme.borderRadius.medium,
    padding: AppTheme.spacing.l,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Stili specifici per il modal del profilo
  profileModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: AppTheme.spacing.l,
  },
  profileModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: AppTheme.borderRadius.large,
    padding: AppTheme.spacing.l,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    // Ensure content does not overflow
    maxHeight: '80%',
  },
  profileInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: AppTheme.borderRadius.medium,
    marginTop: AppTheme.spacing.m,
    marginBottom: AppTheme.spacing.m,
    height: 48, // Altezza fissa per evitare espansioni
    overflow: 'hidden',
  },
  profileInputIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // Does not shrink
  },
  profileTextInput: {
    flex: 1,
    fontSize: AppTheme.fonts.sizes.medium,
    paddingHorizontal: AppTheme.spacing.s,
    paddingVertical: 0, // Rimuove padding verticale per controllo preciso dell'altezza
    height: 46, // Altezza leggermente inferiore al container
    textAlignVertical: 'center', // Android
  },
  modalTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    marginBottom: AppTheme.spacing.m, // Ridotto da l a m
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: AppTheme.borderRadius.medium,
    marginBottom: AppTheme.spacing.m,
    overflow: 'hidden',
  },
  modalInput: {
    flex: 1,
    padding: AppTheme.spacing.m,
    fontSize: AppTheme.fonts.sizes.medium,
  },
  eyeIcon: {
    padding: AppTheme.spacing.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: AppTheme.fonts.sizes.small,
    marginBottom: AppTheme.spacing.m,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: AppTheme.spacing.m,
  },
  modalButton: {
    flex: 1,
    paddingVertical: AppTheme.spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AppTheme.borderRadius.medium,
    marginHorizontal: AppTheme.spacing.xs,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  cancelButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: AppTheme.colors.primary,
    marginLeft: AppTheme.spacing.s,
  },
  confirmButtonText: {
    color: AppTheme.colors.textLight,
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  logoutButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'medium',
    color: AppTheme.colors.error,
    textAlign: 'center',
  },
  selectionOptionItem: {
    padding: AppTheme.spacing.l,
    borderBottomWidth: 1,
  },
  selectionOptionText: {
    fontSize: AppTheme.fonts.sizes.medium,
    textAlign: 'center',
  },
  selectionCancelButton: {
    padding: AppTheme.spacing.l,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  selectionCancelButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  notificationOptionsContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: AppTheme.spacing.l,
  },
  notificationOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: AppTheme.spacing.m,
    borderBottomWidth: 1,
  },
  notificationOptionTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: AppTheme.spacing.m,
  },
  notificationOptionIcon: {
    marginRight: AppTheme.spacing.s,
  },
  notificationOptionText: {
    fontSize: AppTheme.fonts.sizes.medium,
  },
  settingItemText: {
    fontSize: AppTheme.fonts.sizes.medium,
    marginLeft: AppTheme.spacing.m,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: AppTheme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 2,
    borderColor: AppTheme.colors.primary,
  },
  profileTextContainer: {
    marginLeft: AppTheme.spacing.m,
    flex: 1,
  },
  profileName: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: AppTheme.spacing.m,
    paddingVertical: AppTheme.spacing.s, // Aggiungiamo padding verticale
  },
  editAvatarContainer: {
    width: 80, // Ridotto da 100 a 80
    height: 80, // Ridotto da 100 a 80
    borderRadius: 40, // Updated for the new size
    overflow: 'visible',
    backgroundColor: AppTheme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: AppTheme.spacing.s,
    borderWidth: 2,
    borderColor: AppTheme.colors.primary,
  },
  avatarHint: {
    fontSize: AppTheme.fonts.sizes.small,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: AppTheme.spacing.s, // Padding per evitare che il testo tocchi i bordi
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: AppTheme.colors.primary,
    borderRadius: 16, // Ridotto da 18 a 16
    padding: 4, // Ridotto da 6 a 4
    zIndex: 10,
    ...AppTheme.shadows.small,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40, // Updated for the new size
  },
  selectionItem: {
    padding: AppTheme.spacing.m,
    marginBottom: AppTheme.spacing.s,
  },
  selectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionItemText: {
    fontSize: AppTheme.fonts.sizes.medium,
  },
  pinRequirement: {
    fontSize: AppTheme.fonts.sizes.small,
    marginBottom: AppTheme.spacing.m,
    textAlign: 'center',
  },
  sectionContent: {
    padding: AppTheme.spacing.m,
  },
  notificationSubSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: AppTheme.spacing.s,
    paddingHorizontal: AppTheme.spacing.m,
    marginLeft: AppTheme.spacing.l,
    marginBottom: AppTheme.spacing.xs,
  },
  notificationSubSettingLabel: {
    fontSize: AppTheme.fonts.sizes.small,
    fontWeight: 'medium',
  },
  modalSelectionItemText: {
    fontSize: AppTheme.fonts.sizes.medium,
    textAlign: 'center',
  },
  supportContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coffeeEmoji: {
    fontSize: 24,
    marginRight: AppTheme.spacing.m,
  },
  // Stili per i dialog
  modalBody: {
    padding: AppTheme.spacing.m,
  },
  modalText: {
    fontSize: AppTheme.fonts.sizes.medium,
    marginBottom: AppTheme.spacing.m,
    // Color is not specified here because it is set dynamically in JSX
  },
  optionRow: {
    marginBottom: AppTheme.spacing.m,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppTheme.spacing.s,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    // borderColor is set dynamically in JSX based on the theme
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppTheme.spacing.s,
  },
  checkboxLabel: {
    fontSize: AppTheme.fonts.sizes.medium,
    // Color is not specified here because it is set dynamically in JSX
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: AppTheme.borderRadius.small,
    paddingHorizontal: AppTheme.spacing.m,
    fontSize: AppTheme.fonts.sizes.medium,
  },
  button: {
    paddingVertical: AppTheme.spacing.m,
    paddingHorizontal: AppTheme.spacing.l,
    borderRadius: AppTheme.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
    // Color is set dynamically in JSX based on the theme
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: AppTheme.spacing.m,
    borderBottomWidth: 1,
  },
  formGroup: {
    marginBottom: AppTheme.spacing.m,
  },
  label: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
    marginBottom: AppTheme.spacing.s,
    // Color is not specified here because it is set dynamically in JSX
  },
  selectionOptionsContainer: {
    padding: AppTheme.spacing.m,
  },
  saveButton: {
    backgroundColor: AppTheme.colors.primary,
    marginLeft: AppTheme.spacing.s,
  },
  saveButtonText: {
    color: AppTheme.colors.textLight,
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  modalOption: {
    padding: AppTheme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.border,
  },
  modalOptionText: {
    fontSize: AppTheme.fonts.sizes.medium,
    color: AppTheme.colors.text,
  },
  themeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: AppTheme.spacing.m,
    borderBottomWidth: 1,
  },
  modalDescription: {
    fontSize: AppTheme.fonts.sizes.medium,
    lineHeight: AppTheme.fonts.sizes.medium * 1.5,
    textAlign: 'left',
  },
  modalButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
export default SettingsScreen;
