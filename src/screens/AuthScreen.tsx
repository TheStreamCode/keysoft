import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { useAuth } from '../contexts/AuthContext';
import { Auth, Storage, MAX_PASSWORDS_LIMIT } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import ClipboardService from '../services/utils/clipboardService';
import AutoLockService from '../services/utils/autoLockService';
import { UserPreferences } from '../models/User';
import Logger from '../utils/logger';
import { MotionPressable, Reveal } from '../components/ui/motion';
import { PinKeypad } from '../components/ui/pin-keypad';
import { useResponsiveLayout } from '../utils/responsive';
import { ProfileAvatar } from '../components/ProfileAvatar';

type AuthScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const { theme } = useTheme();
  const { login, checkAuthStatus, loginWithBiometrics } = useAuth();
  const { alert } = useAlert();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  // Note: keyboard visibility tracking removed to simplify and avoid RN typing issues
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const isLoginInFlightRef = useRef(false);

  // Security: Clean up sensitive data on unmount
  useEffect(() => {
    return () => {
      // Clear PIN from memory when component unmounts
      setPassword('');
      Logger.debug('AuthScreen: Cleaned up PIN data on unmount');
    };
  }, []);

  // Load user preferences on startup
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const prefs = await Storage.getUserPreferences();
        setUserPreferences(prefs);
      } catch (error) {
        Logger.error('Errore durante il caricamento delle preferenze utente:', error);
      }
    };

    loadUserPreferences();
  }, []);

  useEffect(() => {
    // Mark the initial render as complete after the first pass.
    if (isInitialRender) {
      setIsInitialRender(false);
    }
  }, [isInitialRender]);

  // Keyboard event listeners removed

  useEffect(() => {
    Logger.info('AuthScreen: Verifico disponibilità biometria...');
    checkBiometricsAvailability();
  }, []);

  const checkBiometricsAvailability = async () => {
    try {
      // Check whether biometrics are available on the device
      const { available, biometryType } = await Auth.isBiometricsAvailable();
      Logger.info('Biometria disponibile sul dispositivo:', available, 'Tipo:', biometryType);

      if (!available) {
        Logger.info('Biometria non disponibile sul dispositivo');
        setIsBiometricsAvailable(false);
        setBiometricsEnabled(false);
        return;
      }

      // Check whether the user enabled biometrics in preferences
      const preferences = await Storage.getUserPreferences();
      const biometricsEnabled = preferences?.biometricsEnabled ?? false;
      Logger.info('Biometria abilitata nelle preferenze:', biometricsEnabled);

      // Also check master-key metadata
      const masterKeyInfo = await Auth.getMasterKeyInfo();
      Logger.info('Informazioni chiave master:', masterKeyInfo ? 'Disponibili' : 'Non disponibili');

      // Biometrics are available when supported by the device and enabled in preferences
      setIsBiometricsAvailable(available);
      setBiometricsEnabled(biometricsEnabled);

      // When biometrics are available and enabled, show the button automatically
      if (available && biometricsEnabled) {
        Logger.info('Biometria disponibile e abilitata, mostrando pulsante...');
      }
    } catch (error) {
      Logger.error('Errore durante la verifica della disponibilità della biometria:', error);
      setIsBiometricsAvailable(false);
      setBiometricsEnabled(false);
    }
  };

  const runSuccessfulLoginFollowUp = async (): Promise<void> => {
    try {
      const preferences = await Storage.getUserPreferences();
      const biometricsConfigured = preferences?.biometricsEnabled === true;

      Logger.info('AuthScreen: Login succeeded, biometrics configured:', biometricsConfigured);

      const passwordCount = await Storage.getPasswordCount();

      if (preferences) {
        await Storage.saveUserPreferences({
          ...preferences,
          hasShownPasswordLimitAlert: false,
        });
      }

      if (passwordCount >= MAX_PASSWORDS_LIMIT) {
        setTimeout(() => {
          alert(t('limit_reached'), t('limit_reached_message'), [
            { text: t('ok'), onPress: () => {} },
          ]);
        }, 1000);
      }
    } catch (error) {
      Logger.error('AuthScreen: Error checking password limit after login', error);
    }
  };

  const handleLogin = async (pinValue = password) => {
    if (isLoginInFlightRef.current) {
      return;
    }

    if (!pinValue) {
      setError(t('enter_pin'));
      return;
    }

    isLoginInFlightRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      await waitForNextFrame();
      const success = await login(pinValue);
      if (success) {
        void runSuccessfulLoginFollowUp();

        // Manual navigation removed because it caused an error
        // navigation.navigate('Main', { refresh: Date.now() });
        return;
      } else {
        setError(t(getPinLoginFailureMessageKey()));
        setPassword('');
      }
    } catch (err) {
      setError(t('auth_error'));
      Logger.error('AuthScreen: Authentication error', err);
    } finally {
      isLoginInFlightRef.current = false;
    }

    setIsLoading(false);
  };

  const handleBiometricAuth = async () => {
    try {
      setIsLoading(true);
      setError('');

      Logger.info('Tentativo di autenticazione biometrica...');

      const success = await loginWithBiometrics();
      Logger.info('Risultato autenticazione biometrica:', success);

      if (success) {
        Logger.info('Autenticazione biometrica riuscita, aggiornamento servizi...');

        // Update authentication state in context
        checkAuthStatus();

        // Load user preferences and update services
        try {
          const updatedPreferences = await Storage.getUserPreferences();

          // Update the clipboard timeout
          if (updatedPreferences?.clipboardClearTimeout !== undefined) {
            ClipboardService.updateDefaultTimeout(updatedPreferences.clipboardClearTimeout);
          }

          // Update the auto-lock timeout
          if (updatedPreferences?.autoLockTimeout !== undefined) {
            AutoLockService.updateTimeout(updatedPreferences.autoLockTimeout);
          }
        } catch (error) {
          Logger.error("AuthScreen: Errore durante l'aggiornamento dei servizi:", error);
        }

        try {
          Logger.info('Navigazione a Main dopo autenticazione biometrica...');
          navigation.navigate('Main', { refresh: Date.now() });
        } catch (navError) {
          Logger.error('Errore di navigazione a Main:', navError);
          // Fallback
          try {
            navigation.navigate('Home', { categoryFilter: undefined });
          } catch (homeNavError) {
            Logger.error('Errore di navigazione a Home:', homeNavError);
          }
        }
      } else {
        // If it failed, it might be because no key is stored, or biometrics cancelled/failed.
        const failure = Auth.getLastAuthFailure();
        if (failure?.reason === 'biometric_key_unavailable') {
          setBiometricsEnabled(false);
          alert(t('error'), t(getBiometricFailureMessageKey()));
          return;
        }

        const prefs = await Storage.getUserPreferences();
        if (prefs.biometricsEnabled) {
          alert(t('error'), t(getBiometricFailureMessageKey()));
        }
      }
    } catch (error) {
      Logger.error('AuthScreen: Biometric auth error', error);
      alert(t('error'), t('generic_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const username = userPreferences?.username || t('user');
  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, 480);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView contentContainerStyle={styles.authScroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { width: contentWidth }]}>
          <Reveal style={styles.identity}>
            <View style={styles.avatarSpacing}>
              <ProfileAvatar
                name={username}
                size={64}
                testID="login-profile-avatar"
                uri={userPreferences?.avatar}
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('auth_welcome_back', { name: username })}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {isLoading ? t('logging_in') : t('enter_pin')}
            </Text>
          </Reveal>

          <Reveal delay={80} style={styles.pinArea}>
            <View
              accessibilityLabel={t('pin_digits_entered', { count: password.length })}
              style={styles.pinDots}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor:
                        index < password.length ? theme.colors.primary : 'transparent',
                      borderColor: error ? theme.colors.error : theme.colors.border,
                    },
                  ]}
                />
              ))}
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            ) : null}

            <TextInput
              accessible={false}
              keyboardType="numeric"
              maxLength={6}
              onChangeText={(value) => setPassword(value.replace(/[^0-9]/g, '').slice(0, 6))}
              style={styles.testInput}
              testID="auth-pin-input"
              value={password}
            />

            <PinKeypad
              backspaceLabel={t('backspace')}
              biometricLabel={t('use_biometrics')}
              disabled={isLoading}
              onBiometricPress={
                isBiometricsAvailable && biometricsEnabled ? handleBiometricAuth : undefined
              }
              onChange={(value) => {
                setError('');
                setPassword(value);
              }}
              onComplete={(value) => void handleLogin(value)}
              value={password}
            />

            <MotionPressable
              accessible={false}
              disabled={isLoading}
              onPress={() => void handleLogin()}
              style={styles.testLoginButton}
              testID="auth-login-button"
            >
              <Text>{t('login')}</Text>
            </MotionPressable>

            {isBiometricsAvailable && biometricsEnabled ? (
              <MotionPressable
                accessibilityLabel={t('use_biometrics')}
                accessibilityRole="button"
                disabled={isLoading}
                onPress={handleBiometricAuth}
                style={styles.testBiometricButton}
                testID="auth-biometric-button"
              >
                <Text style={{ color: theme.colors.primary }}>{t('use_biometrics')}</Text>
              </MotionPressable>
            ) : null}
          </Reveal>

          <Reveal delay={150}>
            <MotionPressable
              accessibilityRole="button"
              onPress={() => alert(t('auth_forgot_pin'), t('auth_forgot_pin_message'))}
              style={styles.forgotButton}
            >
              <Text style={[styles.forgotText, { color: theme.colors.textTertiary }]}>
                {t('auth_forgot_pin')}
              </Text>
            </MotionPressable>
          </Reveal>
        </View>
      </ScrollView>

      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingIndicator}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
        </View>
      ) : null}
    </SafeAreaView>
  );
};

function getPinLoginFailureMessageKey(): string {
  const failure = Auth.getLastAuthFailure();

  if (failure?.reason === 'native_kdf_unavailable') {
    return 'native_kdf_unavailable_message';
  }

  if (failure?.reason === 'kdf_timeout') {
    return 'kdf_timeout_message';
  }

  if (failure?.reason === 'init_database_failed') {
    return 'vault_init_error';
  }

  return 'invalid_pin';
}

function getBiometricFailureMessageKey(): string {
  const failure = Auth.getLastAuthFailure();

  if (failure?.reason === 'biometric_key_unavailable') {
    return 'biometric_key_unavailable_message';
  }

  if (failure?.reason === 'init_database_failed') {
    return 'vault_init_error';
  }

  return 'biometric_auth_failed';
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: 'center' },
  authScroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    flex: 1,
    minHeight: 620,
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  identity: { alignItems: 'center' },
  avatarSpacing: { marginBottom: 22 },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  pinArea: { width: '100%', maxWidth: 320, alignSelf: 'center' },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 68,
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  errorText: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  testInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  testLoginButton: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  testBiometricButton: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  forgotButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  forgotText: { fontSize: 12, lineHeight: 16 },
  loadingIndicator: {
    position: 'absolute',
    top: 26,
    alignSelf: 'center',
  },
});

export default AuthScreen;
