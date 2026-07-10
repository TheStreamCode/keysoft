import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { AppTheme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { Auth, Storage, MAX_PASSWORDS_LIMIT } from '../services';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import ClipboardService from '../services/utils/clipboardService';
import AutoLockService from '../services/utils/autoLockService';
import { UserPreferences } from '../models/User';
import Logger from '../utils/logger';

type AuthScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const { theme } = useTheme();
  const { login, checkAuthStatus, loginWithBiometrics } = useAuth();
  const { alert } = useAlert();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  // Note: keyboard visibility tracking removed to simplify and avoid RN typing issues
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isPinVisible, setIsPinVisible] = useState(false);
  const isLoginInFlightRef = useRef(false);

  // Security: Clean up sensitive data on unmount
  useEffect(() => {
    return () => {
      // Clear PIN from memory when component unmounts
      setPassword('');
      Logger.debug('AuthScreen: Cleaned up PIN data on unmount');
    };
  }, []);

  // Create dynamic styles based on the theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: AppTheme.fonts.sizes.xxlarge,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: AppTheme.spacing.s,
    },
    subtitle: {
      fontSize: AppTheme.fonts.sizes.medium,
      color: theme.colors.textSecondary,
      marginBottom: AppTheme.spacing.xl,
      textAlign: 'center',
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: AppTheme.borderRadius.medium,
      padding: AppTheme.spacing.m,
      fontSize: AppTheme.fonts.sizes.large,
      color: theme.colors.text,
      textAlign: 'center',
      width: '100%',
      marginBottom: AppTheme.spacing.m,
      minHeight: 50,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    errorText: {
      color: theme.colors.error,
    },
    loginButton: {
      backgroundColor: theme.colors.primary,
    },
    biometricButton: {
      borderColor: theme.colors.primary,
    },
    biometricButtonText: {
      color: theme.colors.primary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderRadius: AppTheme.borderRadius.medium,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      borderWidth: 1,
      marginBottom: AppTheme.spacing.m,
      minHeight: 55,
    },
    inputField: {
      width: '100%',
      paddingHorizontal: AppTheme.spacing.m,
      paddingRight: 56,
      paddingVertical: AppTheme.spacing.m,
      fontSize: 18,
      letterSpacing: 4,
      color: theme.colors.text,
      textAlign: 'center',
    },
    eyeIcon: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      paddingHorizontal: AppTheme.spacing.m,
      height: '100%',
      justifyContent: 'center',
    },
  });

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

  const handleLogin = async () => {
    if (isLoginInFlightRef.current) {
      return;
    }

    if (!password) {
      setError(t('enter_pin'));
      return;
    }

    isLoginInFlightRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      await waitForNextFrame();
      const success = await login(password);
      if (success) {
        void runSuccessfulLoginFollowUp();

        // Manual navigation removed because it caused an error
        // navigation.navigate('Main', { refresh: Date.now() });
        return;
      } else {
        setError(t(getPinLoginFailureMessageKey()));
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

        // Wait briefly
        await new Promise((resolve) => setTimeout(resolve, 500));

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

  // Toggle PIN visibility
  const togglePinVisibility = () => {
    setIsPinVisible(!isPinVisible);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ flexGrow: 1 }}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.container}>
          <View style={styles.logoContainer}>
            {userPreferences?.avatar ? (
              <Image
                source={{ uri: userPreferences.avatar }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={require('../../assets/images/avatar-user.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            )}
            <Text style={dynamicStyles.title}>{userPreferences?.username || t('user')}</Text>
            <Text
              style={[
                dynamicStyles.title,
                { marginBottom: AppTheme.spacing.xl, fontWeight: 'normal' },
              ]}
            >
              {t('welcome')}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[dynamicStyles.subtitle, { marginBottom: AppTheme.spacing.m }]}>
              {t('enter_pin')}
            </Text>

            {/* PIN input container with visibility icon */}
            <View style={dynamicStyles.inputContainer}>
              <TextInput
                testID="auth-pin-input"
                style={dynamicStyles.inputField}
                placeholder={t('pin_placeholder')}
                placeholderTextColor={theme.colors.text + '60'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPinVisible}
                keyboardType="numeric"
                maxLength={6}
                numberOfLines={1}
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel={t('enter_pin')}
              />
              <TouchableOpacity
                onPress={togglePinVisibility}
                style={dynamicStyles.eyeIcon}
                accessibilityLabel={isPinVisible ? t('hide_password') : t('show_password')}
                accessibilityRole="button"
              >
                <Ionicons
                  name={isPinVisible ? 'eye-off' : 'eye'}
                  size={24}
                  color={theme.colors.text + '80'}
                />
              </TouchableOpacity>
            </View>

            {error ? (
              <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
            ) : null}

            <TouchableOpacity
              testID="auth-login-button"
              style={[
                styles.loginButton,
                dynamicStyles.loginButton,
                { borderWidth: 1, borderColor: theme.colors.border },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.textLight} size="small" />
              ) : (
                <Text style={[styles.loginButtonText, { color: theme.colors.textLight }]}>
                  {t('login')}
                </Text>
              )}
            </TouchableOpacity>

            {isBiometricsAvailable && biometricsEnabled && (
              <TouchableOpacity
                testID="auth-biometric-button"
                style={[
                  styles.biometricButton,
                  dynamicStyles.biometricButton,
                  { borderWidth: 2 },
                  isLoading && { opacity: 0.5 },
                ]}
                onPress={handleBiometricAuth}
                disabled={isLoading}
                accessibilityLabel={t('use_biometrics')}
                accessibilityRole="button"
              >
                <Ionicons name="finger-print" size={24} color={theme.colors.primary} />
                <Text style={[styles.biometricButtonText, dynamicStyles.biometricButtonText]}>
                  {t('use_biometrics')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Loading modal shown during login */}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: theme.colors.backgroundElevated }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              {t('logging_in')}
            </Text>
            <Text style={[styles.loadingSubtext, { color: theme.colors.textSecondary }]}>
              {t('please_wait')}
            </Text>
          </View>
        </View>
      </Modal>
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
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: AppTheme.colors.primary + '30',
    backgroundColor: AppTheme.colors.primary + '15',
  },
  headerAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  formContainer: {
    width: '80%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  errorText: {
    fontSize: AppTheme.fonts.sizes.small,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  loginButton: {
    borderRadius: AppTheme.borderRadius.pill,
    paddingVertical: AppTheme.spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppTheme.spacing.m,
    ...Platform.select({
      web: {
        boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.16)',
      } as any,
      ios: AppTheme.shadows.medium,
      android: AppTheme.shadows.medium,
    }),
  },
  loginButtonText: {
    color: 'white',
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
    borderWidth: 1,
    borderRadius: AppTheme.borderRadius.pill,
  },
  biometricButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'medium',
    marginLeft: AppTheme.spacing.s,
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
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
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

export default AuthScreen;
