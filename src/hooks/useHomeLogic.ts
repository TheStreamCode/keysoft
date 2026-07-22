import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { Password } from '../models/Password';
import { UserPreferences } from '../models/User';
import { Storage, Auth, MAX_PASSWORDS_LIMIT } from '../services';
import Logger from '../utils/logger';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;

const PASSWORDS_PER_PAGE = 20;
const CACHE_TIMEOUT = 60_000;
const SEARCH_CACHE_MAX_ENTRIES = 50;

type SearchCacheEntry = { passwords: Password[]; timestamp: number; total: number };

/**
 * Inserisce una entry nella cache mantenendo un cap massimo di entries.
 * When the cap is exceeded, evicts the oldest entry by timestamp.
 */
function setCacheEntry(
  cache: Record<string, SearchCacheEntry>,
  key: string,
  entry: SearchCacheEntry,
): void {
  cache[key] = entry;
  const keys = Object.keys(cache);
  if (keys.length <= SEARCH_CACHE_MAX_ENTRIES) return;

  // LRU eviction: find the oldest entry, excluding the one just inserted.
  // Without the exclusion, duplicate timestamps could cause the new entry
  // essere immediatamente evictata.
  let oldestKey: string | null = null;
  let oldestTimestamp = Infinity;
  for (const k of keys) {
    if (k === key) continue;
    if (cache[k].timestamp < oldestTimestamp) {
      oldestTimestamp = cache[k].timestamp;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) {
    delete cache[oldestKey];
  }
}

export const useHomeLogic = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<HomeScreenRouteProp>();
  const { alert: customAlert, notify } = useAlert();
  const { t } = useLanguage();

  // Route Params
  const categoryFilter = route.params?.categoryFilter;
  const refresh = route.params?.refresh;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePasswords, setHasMorePasswords] = useState(true);
  const [totalPasswords, setTotalPasswords] = useState(0);
  const [categoryTotalPasswords, setCategoryTotalPasswords] = useState<number | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [hasShownBiometricPrompt, setHasShownBiometricPrompt] = useState(false);
  const [hasUiError, setHasUiError] = useState(false);

  // Refs
  const currentOffset = React.useRef(0);
  const searchCache = React.useRef<Record<string, SearchCacheEntry>>({});
  const hasShownLimitAlert = React.useRef(false);
  const hasFocusedOnce = React.useRef(false);

  // --- Logic Methods ---

  const loadPasswords = useCallback(
    async (isInitialLoad: boolean = false) => {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const cacheKey = `${categoryFilter || 'all'}_${deferredSearchQuery || 'none'}_${currentOffset.current}`;
        const now = Date.now();

        // Check Cache
        const cachedResult = searchCache.current[cacheKey];
        const isCacheValid =
          isInitialLoad && cachedResult && now - cachedResult.timestamp < CACHE_TIMEOUT;

        if (isCacheValid) {
          Logger.debug(`Usando risultati in cache per ${cacheKey}`);

          setPasswords(cachedResult.passwords);
          setTotalPasswords(cachedResult.total);
          setCategoryTotalPasswords(categoryFilter ? cachedResult.total : null);
          setHasMorePasswords(
            currentOffset.current + cachedResult.passwords.length < cachedResult.total,
          );
          currentOffset.current += cachedResult.passwords.length;
          setHasUiError(false);
        } else {
          // Fetch from Storage
          const result = await Storage.getPasswordsPaginated(
            PASSWORDS_PER_PAGE,
            currentOffset.current,
            categoryFilter,
            deferredSearchQuery,
          );

          Logger.debug(`Caricate ${result.passwords.length} password, totale: ${result.total}`);

          setTotalPasswords(result.total);
          setCategoryTotalPasswords(categoryFilter ? result.total : null);

          if (isInitialLoad) {
            setCacheEntry(searchCache.current, cacheKey, {
              passwords: result.passwords,
              timestamp: now,
              total: result.total,
            });
          }

          setHasMorePasswords(currentOffset.current + result.passwords.length < result.total);
          currentOffset.current += result.passwords.length;

          if (isInitialLoad) {
            setPasswords(result.passwords);
          } else {
            setPasswords((prevPasswords) => [...prevPasswords, ...result.passwords]);
          }

          setHasUiError(false);

          // Limit Alert
          if (isInitialLoad && !hasShownLimitAlert.current && result.total >= MAX_PASSWORDS_LIMIT) {
            try {
              const prefs = await Storage.getUserPreferences();
              if (!prefs.hasShownPasswordLimitAlert) {
                customAlert(
                  t('limit_reached'),
                  t('limit_reached_message').replace('1000', String(MAX_PASSWORDS_LIMIT)),
                  [{ text: t('ok'), onPress: () => {} }],
                );
                await Storage.saveUserPreferences({
                  ...prefs,
                  hasShownPasswordLimitAlert: true,
                });
              }
              hasShownLimitAlert.current = true;
            } catch (_error) {
              hasShownLimitAlert.current = true;
            }
          }
        }
      } catch (_error) {
        Logger.error('Errore durante il caricamento delle password:', _error);
        if (isInitialLoad) setPasswords([]);

        customAlert(t('loading_error'), t('loading_error_message'), [
          { text: t('ok'), onPress: () => {} },
        ]);
        setHasUiError(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [categoryFilter, customAlert, deferredSearchQuery, t],
  );

  const invalidateCacheAndReload = useCallback(() => {
    searchCache.current = {};
    currentOffset.current = 0;
    setPasswords([]);
    setHasMorePasswords(true);
    setIsLoading(true);
    loadPasswords(true);
  }, [loadPasswords]);

  const loadPreferences = useCallback(async (): Promise<void> => {
    try {
      const prefs = await Storage.getUserPreferences();
      setUserPreferences(prefs);
    } catch (error) {
      Logger.error('Errore durante il caricamento delle preferenze utente:', error);
    }
  }, []);

  const checkBiometrics = useCallback(async () => {
    try {
      const { available, biometryType } = await Auth.isBiometricsAvailable();
      const biometricsEnabled = userPreferences?.biometricsEnabled === true;
      const hasPromptedForBiometrics = userPreferences?.hasPromptedForBiometrics === true;

      Logger.info(
        'HomeScreen: Biometria disponibile:',
        available,
        'Tipo:',
        biometryType,
        'Già abilitata:',
        biometricsEnabled,
      );

      if (available && !biometricsEnabled && !hasPromptedForBiometrics) {
        const preferences = await Storage.getUserPreferences();
        await Storage.saveUserPreferences({
          ...preferences,
          hasPromptedForBiometrics: true,
        });

        if (userPreferences) {
          setUserPreferences({ ...userPreferences, hasPromptedForBiometrics: true });
        }

        setTimeout(() => {
          customAlert(t('enable_biometrics_title'), t('enable_biometrics_message'), [
            { text: t('enable_biometrics_later'), onPress: () => {}, style: 'cancel' },
            {
              text: t('enable_biometrics_enable'),
              onPress: async () => {
                try {
                  const enabled = await Auth.enableBiometrics();
                  if (enabled) {
                    const updatedPreferences = await Storage.getUserPreferences();
                    setUserPreferences(updatedPreferences);
                    customAlert(t('biometrics_enabled'), t('biometrics_enabled_message'));
                  } else {
                    customAlert(t('error'), t('biometrics_verification_error'));
                  }
                } catch (_error) {
                  customAlert(t('error'), t('biometrics_setup_error'));
                }
              },
            },
          ]);
        }, 500);
      }
    } catch (error) {
      Logger.error('Errore durante la verifica della biometria:', error);
    }
  }, [userPreferences, t, customAlert]);

  const safeHandleRefresh = useCallback((): void => {
    try {
      setHasUiError(false);
      setIsLoading(true);
      currentOffset.current = 0;
      setPasswords([]);
      setHasMorePasswords(true);
      setSearchQuery('');
      setCategoryTotalPasswords(null);
      navigation.setParams({ categoryFilter: undefined });
      void loadPasswords(true);
    } catch (error) {
      Logger.error('Errore durante il refresh protetto:', error);
      setIsLoading(false);
      setHasUiError(true);
    }
  }, [loadPasswords, navigation]);

  const handleDeletePassword = useCallback(
    (id: string) => {
      customAlert(t('delete_confirmation'), t('delete_confirmation_message'), [
        { text: t('cancel'), style: 'cancel', onPress: () => {} },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Storage.deletePassword(id);
              setPasswords((prev) => prev.filter((p) => p.id !== id));
              setTotalPasswords((prev) => prev - 1);
              searchCache.current = {};
              invalidateCacheAndReload();
              notify(t('delete_success_message'), 'success');
            } catch (error) {
              Logger.error("Errore durante l'eliminazione della password:", error);
              customAlert(t('error'), t('save_error_message'));
            }
          },
        },
      ]);
    },
    [customAlert, invalidateCacheAndReload, notify, t],
  );

  // --- Effects ---

  // Load identity data even when a responsive/navigation remount happens after
  // the initial focus event has already fired.
  useEffect(() => {
    const initialPreferencesLoad = setTimeout(() => void loadPreferences(), 0);
    return () => clearTimeout(initialPreferencesLoad);
  }, [loadPreferences]);

  // Focus Effect
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      try {
        void loadPreferences();
        setHasUiError(false);

        if (!hasFocusedOnce.current) {
          hasFocusedOnce.current = true;
          return;
        }

        // Reset and reload on focus
        currentOffset.current = 0;
        setPasswords([]);
        setHasMorePasswords(true);
        searchCache.current = {};
        void loadPasswords(true);
      } catch (error) {
        Logger.error('Errore durante il focusEffect simulato:', error);
        setHasUiError(true);
      }
    });
    return unsubscribe;
  }, [loadPasswords, loadPreferences, navigation, refresh]);

  // Biometrics Prompt
  useEffect(() => {
    if (!hasShownBiometricPrompt && userPreferences) {
      checkBiometrics();
      setHasShownBiometricPrompt(true);
    }
  }, [userPreferences, hasShownBiometricPrompt, checkBiometrics]);

  // Forced Refresh param
  useEffect(() => {
    if (refresh) {
      Logger.debug('Refresh forzato con timestamp:', refresh);
      invalidateCacheAndReload();
    }
  }, [refresh, invalidateCacheAndReload]);

  // Filter Changes
  useEffect(() => {
    searchCache.current = {};
    currentOffset.current = 0;
    setPasswords([]);
    setHasMorePasswords(true);
    loadPasswords(true);
  }, [categoryFilter, searchQuery, loadPasswords]);

  // Cache Cleanup periodico (rimuove entries scadute).
  // LRU eviction is already handled by setCacheEntry; here we only discard stale records.
  useEffect(() => {
    const cleanupCache = () => {
      const now = Date.now();
      const entries = Object.entries(searchCache.current);
      for (const [key, value] of entries) {
        if (now - value.timestamp > CACHE_TIMEOUT) {
          delete searchCache.current[key];
        }
      }
    };
    const interval = setInterval(cleanupCache, CACHE_TIMEOUT);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---

  const handleLoadMore = useCallback((): void => {
    if (!isLoadingMore && hasMorePasswords) {
      loadPasswords(false);
    }
  }, [hasMorePasswords, isLoadingMore, loadPasswords]);

  const handleFilterByCategory = useCallback(
    (categoryId: string): void => {
      // Reset the filter when selecting "All" ('all') or the currently active category
      if (categoryId === 'all' || categoryFilter === categoryId) {
        navigation.setParams({ categoryFilter: undefined });
        setCategoryTotalPasswords(null);
      } else {
        navigation.setParams({ categoryFilter: categoryId });
      }
      currentOffset.current = 0;
    },
    [categoryFilter, navigation],
  );

  const handleAddPassword = useCallback(async (): Promise<void> => {
    try {
      const canAdd = await Storage.canAddPassword();
      if (!canAdd) {
        hasShownLimitAlert.current = false;
        try {
          const prefs = await Storage.getUserPreferences();
          await Storage.saveUserPreferences({
            ...prefs,
            hasShownPasswordLimitAlert: false,
          });
        } catch (_error) {
          Logger.warn('Impossibile aggiornare il flag di limite password');
        }
        customAlert(
          t('limit_reached'),
          t('limit_reached_message').replace('1000', String(MAX_PASSWORDS_LIMIT)),
        );
        return;
      }
      navigation.navigate('PasswordDetail', { mode: 'create' });
    } catch (_error) {
      customAlert(t('error'), t('password_limit_check_error'));
    }
  }, [customAlert, navigation, t]);

  return {
    // State
    passwords,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    userPreferences,
    totalPasswords,
    categoryTotalPasswords,
    hasUiError,

    // Actions
    handleLoadMore,
    handleRefresh: safeHandleRefresh,
    handleDeletePassword,
    handleFilterByCategory,
    handleAddPassword,
    navigate: navigation.navigate, // Expose navigate for simple actions
  };
};
