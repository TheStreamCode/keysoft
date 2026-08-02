import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { UserMasterKey } from '../models/User';
import { Auth, Storage } from '../services';
import Logger from '../utils/logger';
import AutoLockService from '../services/utils/autoLockService';
import ClipboardService from '../services/utils/clipboardService';
import NotificationService from '../services/utils/notificationService';
import { useLanguage } from './LanguageContext';
import { useAlert } from './AlertContext';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  masterKeyInfo: UserMasterKey | null;
  login: (password: string) => Promise<boolean>;
  logout: (resetComplete?: boolean) => void;
  setupMasterPassword: (password: string, showBiometricPrompt?: boolean) => Promise<boolean>;
  updateMasterPassword: (password: string) => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  isMasterPasswordConfigured: boolean;
  checkAuthStatus: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const { alert } = useAlert();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [masterKeyInfo, setMasterKeyInfo] = useState<UserMasterKey | null>(null);
  const [isMasterPasswordConfigured, setIsMasterPasswordConfigured] = useState(false);

  // Track pending timeouts so they can be cancelled on logout/unmount.
  const pendingTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef(true);

  const scheduleTimeout = useCallback((fn: () => void, delay: number): void => {
    const id = setTimeout(() => {
      pendingTimeouts.current.delete(id);
      if (!isMountedRef.current) return;
      fn();
    }, delay);
    pendingTimeouts.current.add(id);
  }, []);

  const clearPendingTimeouts = useCallback((): void => {
    pendingTimeouts.current.forEach((id) => clearTimeout(id));
    pendingTimeouts.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearPendingTimeouts();
    };
  }, [clearPendingTimeouts]);

  useEffect(() => {
    NotificationService.setTranslator(t);
  }, [t]);

  // Extracted helper to avoid duplicating preference-loading logic.
  const loadUserPreferencesAndSyncServices = useCallback(
    async (
      options: { syncNotifications?: boolean; runPeriodicChecks?: boolean } = {},
    ): Promise<void> => {
      const { syncNotifications = false, runPeriodicChecks = false } = options;

      try {
        const preferences = await Storage.getUserPreferences();

        if (preferences?.clipboardClearTimeout !== undefined) {
          ClipboardService.updateDefaultTimeout(preferences.clipboardClearTimeout);
          Logger.debug(
            `AuthContext: Timeout clipboard aggiornato a ${preferences.clipboardClearTimeout} secondi`,
          );
        }

        if (preferences?.autoLockTimeout !== undefined) {
          AutoLockService.updateTimeout(preferences.autoLockTimeout);
          Logger.debug(
            `AuthContext: Timeout blocco automatico aggiornato a ${preferences.autoLockTimeout} secondi`,
          );
        }

        if (syncNotifications && preferences?.notificationSettings) {
          NotificationService.updateSettings(preferences.notificationSettings);
          Logger.debug('AuthContext: Impostazioni notifiche sincronizzate');
        }

        if (runPeriodicChecks) {
          // Run periodic checks after a delay to avoid affecting startup.
          // The timeout is tracked and cancelled on logout/unmount.
          // Le operazioni async interne ricontrollano isMountedRef ad ogni await
          // per evitare write su componente smontato.
          scheduleTimeout(async () => {
            try {
              Logger.debug('AuthContext: Esecuzione controlli periodici notifiche...');
              const passwords = await Storage.getAllPasswords();
              if (!isMountedRef.current) return;

              const currentPrefs = await Storage.getUserPreferences();
              if (!isMountedRef.current) return;

              const updatedChecks = await NotificationService.checkPeriodicNotifications(
                passwords,
                currentPrefs.lastBackupTime,
                currentPrefs.lastNotificationChecks,
              );
              if (!isMountedRef.current) return;

              if (
                JSON.stringify(updatedChecks) !==
                JSON.stringify(currentPrefs.lastNotificationChecks)
              ) {
                await Storage.saveUserPreferences({
                  ...currentPrefs,
                  lastNotificationChecks: updatedChecks,
                });
                Logger.debug('AuthContext: Controlli notifiche completati e salvati');
              } else {
                Logger.debug('AuthContext: Nessun nuovo controllo notifica necessario');
              }
            } catch (err) {
              Logger.error(
                'AuthContext: Errore durante i controlli periodici delle notifiche',
                err,
              );
            }
          }, 5000);
        }
      } catch (error) {
        Logger.error('AuthContext: Errore durante il caricamento delle preferenze:', error);
        // Do not block the caller flow on error.
      }
    },
    [scheduleTimeout],
  );

  // Check whether the user has already configured a master password
  useEffect(() => {
    const checkMasterPassword = async () => {
      try {
        Logger.debug('AuthContext: Verifica configurazione master password e stato biometria...');

        await Auth.initDatabase();

        const configured = await Auth.isMasterPasswordConfigured();
        setIsMasterPasswordConfigured(configured);

        if (configured) {
          setIsAuthenticated(false);

          try {
            const preferences = await Storage.getUserPreferences();
            Logger.debug("AuthContext: Preferenze utente caricate all'avvio");

            if (preferences?.biometricsEnabled) {
              Logger.debug(
                'AuthContext: Biometria abilitata nelle preferenze, verifico disponibilità...',
              );
              const biometricsRestored = await Auth.restoreBiometricsState();
              Logger.debug('AuthContext: Stato biometria ripristinato:', biometricsRestored);
              Logger.debug(
                "AuthContext: Biometria disponibile, l'utente potrà usare il pulsante nella schermata di login",
              );
            } else {
              Logger.debug('AuthContext: Biometria non abilitata nelle preferenze');
            }
          } catch (error) {
            Logger.error(
              'AuthContext: Errore durante il ripristino dello stato della biometria:',
              error,
            );
          }
        }
      } catch (error) {
        Logger.error('Errore durante la verifica della master password:', error);
        setIsMasterPasswordConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkMasterPassword();
  }, []);

  // Configure the auto-lock service
  useEffect(() => {
    void AutoLockService.initialize();
    AutoLockService.setLockCallback(() => {
      Logger.debug('AuthContext: Blocco automatico attivato, eseguo logout');
      logout();
    });

    return () => {
      AutoLockService.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulePostLoginTasks = useCallback((): void => {
    void (async () => {
      try {
        await loadUserPreferencesAndSyncServices({
          syncNotifications: true,
          runPeriodicChecks: true,
        });
      } catch (error) {
        Logger.error('AuthContext: Deferred post-login tasks failed', error);
      }
    })();
  }, [loadUserPreferencesAndSyncServices]);

  const completeSuccessfulLogin = useCallback(async (): Promise<void> => {
    setIsAuthenticated(true);
    setMasterKeyInfo(Auth.getMasterKeyInfo());
    NotificationService.sendLoginSuccess();
    schedulePostLoginTasks();
  }, [schedulePostLoginTasks]);

  const login = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        const success = await Auth.authenticateWithMasterPassword(password);

        if (success) {
          await completeSuccessfulLogin();
        } else {
          NotificationService.sendLoginFailure();
        }

        return success;
      } catch (error) {
        Logger.error('Errore durante il login:', error);
        NotificationService.sendLoginFailure();
        return false;
      }
    },
    [completeSuccessfulLogin],
  );

  const logout = useCallback(
    (resetComplete: boolean = false) => {
      clearPendingTimeouts();
      Auth.logout();
      setIsAuthenticated(false);
      setMasterKeyInfo(null);

      if (resetComplete) {
        Logger.debug("AuthContext: Reset completo - reindirizzamento all'onboarding");
        setIsMasterPasswordConfigured(false);
      }
    },
    [clearPendingTimeouts],
  );

  const setupMasterPassword = useCallback(
    async (password: string, showBiometricPrompt: boolean = false): Promise<boolean> => {
      try {
        const success = await Auth.setupMasterPassword(password);

        if (success) {
          setIsMasterPasswordConfigured(true);
          setIsAuthenticated(true);
          setMasterKeyInfo(Auth.getMasterKeyInfo());

          await loadUserPreferencesAndSyncServices();

          if (showBiometricPrompt) {
            // Wait briefly so navigation can complete.
            // The timeout is tracked and cancelled on logout/unmount.
            scheduleTimeout(async () => {
              try {
                const { available } = await Auth.isBiometricsAvailable();

                if (!available) {
                  Logger.debug('AuthContext: Biometria non disponibile sul dispositivo');
                  return;
                }

                alert(t('enable_biometrics_title'), t('enable_biometrics_message'), [
                  { text: t('enable_biometrics_later'), onPress: () => {}, style: 'cancel' },
                  {
                    text: t('enable_biometrics_enable'),
                    onPress: async () => {
                      try {
                        const enabled = await Auth.enableBiometrics();
                        if (enabled) {
                          alert(t('biometrics_enabled'), t('biometrics_enabled_message'));
                        } else {
                          alert(t('error'), t('biometrics_verification_error'));
                        }
                      } catch (error) {
                        Logger.error(
                          "AuthContext: Errore durante l'abilitazione della biometria:",
                          error,
                        );
                        alert(t('error'), t('biometrics_setup_error'));
                      }
                    },
                  },
                ]);
              } catch (error) {
                Logger.error('AuthContext: Errore durante la verifica della biometria:', error);
              }
            }, 500);
          }
        }

        return success;
      } catch (error) {
        Logger.error('Errore durante la configurazione della master password:', error);
        return false;
      }
    },
    [alert, loadUserPreferencesAndSyncServices, scheduleTimeout, t],
  );

  const updateMasterPassword = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        const success = await Auth.updateMasterPassword(password);

        if (success) {
          setIsMasterPasswordConfigured(true);
          setIsAuthenticated(true);
          setMasterKeyInfo(Auth.getMasterKeyInfo());
          await loadUserPreferencesAndSyncServices();
        } else if (!Auth.getIsAuthenticated()) {
          // If Auth forced logout because updateMasterPassword rollback failed,
          // synchronize React state so the UI does not remain "logged in" with
          // an empty encryptionKey that makes encrypted operations fail silently.
          Logger.warn('AuthContext: forced logout detected after failed master password update');
          logout();
        }

        return success;
      } catch (error) {
        Logger.error('Errore durante la aggiornamento della master password:', error);
        return false;
      }
    },
    [loadUserPreferencesAndSyncServices, logout],
  );

  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    return await Auth.enableBiometrics();
  }, []);

  const loginWithBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await Auth.loginWithBiometrics();
    if (success) {
      await completeSuccessfulLogin();
    }
    return success;
  }, [completeSuccessfulLogin]);

  const checkAuthStatus = useCallback(() => {
    const authenticated = Auth.getIsAuthenticated();
    Logger.debug('AuthContext: Verifica stato autenticazione:', authenticated);

    setIsAuthenticated(authenticated);

    if (authenticated) {
      setMasterKeyInfo(Auth.getMasterKeyInfo());
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      isLoading,
      masterKeyInfo,
      login,
      logout,
      setupMasterPassword,
      updateMasterPassword,
      enableBiometrics,
      loginWithBiometrics,
      isMasterPasswordConfigured,
      checkAuthStatus,
    }),
    [
      isAuthenticated,
      isLoading,
      masterKeyInfo,
      login,
      logout,
      setupMasterPassword,
      updateMasterPassword,
      enableBiometrics,
      loginWithBiometrics,
      isMasterPasswordConfigured,
      checkAuthStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
