import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import packageJson from '../../package.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { AppTheme } from '../constants/theme';
import { SUPPORT_EMAIL } from '../constants/contact';
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
import { copyPlainTextWithFeedback } from '../utils/clipboardUtils';
import { NotificationType } from '../services/utils/notificationService';
import Constants from 'expo-constants';
import { ListItem } from '../components/ui/list-item';
import UISwitch from '../components/ui/switch';
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
  // Notification settings are managed by useNotificationSettings (see below)

  const { logout, updateMasterPassword, enableBiometrics } = useAuth();
  const { theme, isDarkMode, setThemeMode, themeMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { alert, notify } = useAlert();

  // Support is handled over email rather than a web page, and not every device has a
  // mail client registered, so the address goes to the clipboard when the intent fails.
  // The mailto is opened without asking canOpenURL first: opening a URL is a plain
  // startActivity, which needs no <queries> entry in the manifest, while canOpenURL goes
  // through queryIntentActivities and therefore reports false (or rejects) on Android 11+
  // unless the mailto scheme is declared there.
  const handleSupportPress = useCallback(async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
      return;
    } catch (error) {
      Logger.warn('SettingsScreen: unable to open the mail client', error);
    }
    await copyPlainTextWithFeedback(SUPPORT_EMAIL, notify, {
      successMessage: t('support_email_copied'),
      errorMessage: t('copy_error_message'),
    });
  }, [notify, t]);

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

  // Add an effect to handle the initial layout phase
  useEffect(() => {
    // Use a short timeout to ensure the layout is calculated correctly
    const layoutTimeout = setTimeout(() => {
      setInitialLayoutComplete(true);
    }, 100);

    return () => clearTimeout(layoutTimeout);
  }, []);

  const savePreferences = useCallback(
    async (newPreferences: UserPreferences): Promise<boolean> => {
      try {
        await Storage.saveUserPreferences(newPreferences);
        setPreferences(newPreferences);
        return true;
      } catch (error) {
        Logger.error('Errore durante il salvataggio delle preferenze:', error);
        alert(t('error'), t('preferences_save_error'));
        return false;
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

  // Notification settings hook.
  // Declare it after loadPreferences so it can be passed as reloadPreferences.
  const { settings: notificationSettings, setSettings: setNotificationSettings } =
    useNotificationSettings({
      preferences,
      setPreferences,
      reloadPreferences: loadPreferences,
      t,
      alert,
    });

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
    closeImportPasswordDialog,
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

      // Save the updated preferences
      const isSaved = await savePreferences(updatedPreferences);
      if (!isSaved) return;

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

  const handleChangeAutoLockTimeout = async (value: number) => {
    if (!preferences) return;

    const updatedPreferences = {
      ...preferences,
      autoLockTimeout: value,
    };

    const isSaved = await savePreferences(updatedPreferences);
    if (!isSaved) return;

    // Update the auto-lock service timeout
    AutoLockService.updateTimeout(value);
    Logger.debug(`SettingsScreen: Timeout blocco automatico aggiornato a ${value} secondi`);
  };

  const handleChangeClipboardClearTimeout = async (value: number) => {
    if (!preferences) return;

    const updatedPreferences = {
      ...preferences,
      clipboardClearTimeout: value,
    };

    const isSaved = await savePreferences(updatedPreferences);
    if (!isSaved) return;

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
              onPress={handleSupportPress}
              rightIcon="mail-outline"
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
            {t('contribution')}
          </Text>
          <View style={styles.compactGroup}>
            <ListItem
              iconColor={theme.colors.primary}
              leftIcon="heart-outline"
              title={t('sponsor_github')}
              onPress={() => Linking.openURL('https://github.com/sponsors/TheStreamCode')}
              rightIcon="open-outline"
              style={styles.compactRow}
            />
          </View>
        </Reveal>

        <Reveal delay={210}>
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
        onClose={closeImportPasswordDialog}
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
          onPress={closeImportPasswordDialog}
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
  title: {
    textAlign: 'left',
    letterSpacing: -0.35,
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
  pinRequirement: {
    fontSize: AppTheme.fonts.sizes.small,
    marginBottom: AppTheme.spacing.m,
    textAlign: 'center',
  },
  modalText: {
    fontSize: AppTheme.fonts.sizes.medium,
    marginBottom: AppTheme.spacing.m,
    // Color is not specified here because it is set dynamically in JSX
  },
  modalDescription: {
    fontSize: AppTheme.fonts.sizes.medium,
    lineHeight: AppTheme.fonts.sizes.medium * 1.5,
    textAlign: 'left',
  },
});

export default SettingsScreen;
